import { MediaBrief } from "@/lib/domain/run";
import { createRun } from "@/lib/ledger/runs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = MediaBrief.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid media brief.", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const run = createRun(parsed.data);
    return Response.json({ run }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create run." }, { status: 500 });
  }
}
