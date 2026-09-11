import { getRun } from "@/lib/ledger/runs";
import { executeRun } from "@/lib/agent/orchestrator";

export const maxDuration = 900;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) return Response.json({ error: "Run not found." }, { status: 404 });
  if (["planning", "generating", "evaluating", "improving"].includes(run.status)) {
    return Response.json({ error: "Run is already executing." }, { status: 409 });
  }

  void executeRun(id).catch((error: unknown) => {
    console.error(`[liverloop] run ${id} failed`, error);
  });

  return Response.json({ runId: id, status: "started" }, { status: 202 });
}
