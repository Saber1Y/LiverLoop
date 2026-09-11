import { getRun } from "@/lib/ledger/runs";
import { getRunEvents } from "@/lib/ledger/events";
import { getRunVersions } from "@/lib/ledger/versions";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) return Response.json({ error: "Run not found." }, { status: 404 });

  return Response.json({
    run,
    events: getRunEvents(id),
    versions: getRunVersions(id),
  });
}
