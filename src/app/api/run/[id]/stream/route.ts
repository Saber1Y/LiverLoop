import { getRun } from "@/lib/ledger/runs";
import { getRunEvents, type LedgerEvent } from "@/lib/ledger/events";
import { getRunVersions } from "@/lib/ledger/versions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 900;

const POLL_MS = 1200;
const HEARTBEAT_MS = 15_000;
const DRAIN_POLLS = 3;
const HARD_TIMEOUT_MS = 30 * 60 * 1000;

function sseMessage(event: string, data: unknown, id?: string): string {
  const lines = JSON.stringify(data).replace(/\n/g, "");
  return `${id ? `id: ${id}\n` : ""}event: ${event}\ndata: ${lines}\n\n`;
}

function eventsAfter(events: LedgerEvent[], afterId: string | null): LedgerEvent[] {
  if (!afterId) return events;
  const index = events.findIndex((event) => event.id === afterId);
  if (index === -1) return events;
  return events.slice(0, index);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) return Response.json({ error: "Run not found." }, { status: 404 });

  const url = new URL(request.url);
  const initialCursor = url.searchParams.get("after") ?? request.headers.get("last-event-id");

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let cursor = initialCursor;
      let drainedPolls = 0;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      let lastRun: { status: string; totalCost: number } | null = null;
      const startedAt = Date.now();

      try {
        controller.enqueue(encoder.encode(sseMessage("snapshot", {
          run,
          versions: getRunVersions(id),
          events: getRunEvents(id),
        })));

        heartbeatTimer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            if (heartbeatTimer) clearInterval(heartbeatTimer);
          }
        }, HEARTBEAT_MS);

        for (;;) {
          if (Date.now() - startedAt > HARD_TIMEOUT_MS) {
            controller.enqueue(encoder.encode(sseMessage("close", { reason: "stream timeout" })));
            break;
          }

          const currentRun = getRun(id);
          const events = getRunEvents(id);
          const pending = eventsAfter(events, cursor ?? null).reverse();

          for (const event of pending) {
            controller.enqueue(encoder.encode(sseMessage("event", event, event.id)));
            cursor = event.id;
          }

          if (currentRun) {
            const runSignature = `${currentRun.status}:${currentRun.totalCost}`;
            if (lastRun === null || `${lastRun.status}:${lastRun.totalCost}` !== runSignature) {
              lastRun = { status: currentRun.status, totalCost: currentRun.totalCost };
              controller.enqueue(encoder.encode(sseMessage("status", { run: currentRun })));
            }
          }
          const terminal = currentRun?.status === "completed" || currentRun?.status === "failed";
          if (terminal) {
            drainedPolls = pending.length === 0 ? drainedPolls + 1 : 0;
            if (drainedPolls >= DRAIN_POLLS) {
              controller.enqueue(encoder.encode(sseMessage("close", { reason: "terminal" })));
              break;
            }
          } else {
            drainedPolls = 0;
          }

          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        }
      } catch {
        controller.enqueue(encoder.encode(sseMessage("close", { reason: "error" })));
      } finally {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {
          // Stream may already be closed by the client.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}