import { listCapabilitiesByType } from "./capabilities";
import { runMediaJob } from "./jobs";

async function main() {
  console.log("Fetching image capabilities...");
  const images = await listCapabilitiesByType("image");
  console.log(`Found ${images.length} image capabilities. First 5:`);
  console.log(images.slice(0, 5).map((c) => `${c.name} (${c.model_id})`));

  console.log("\nRunning flux-schnell generation...");
  const result = await runMediaJob({
    capability: "flux-schnell",
    prompt: "a tiny red fox in a snowy forest at dawn, cinematic golden light",
    timeout: 60,
  });
  console.log("Result:", JSON.stringify(
    {
      ok: result.ok,
      output_kind: result.output_kind,
      url: result.url,
      cost_usd_estimated: result.cost_usd_estimated,
      budget_headroom_usd: result.budget_headroom_usd,
    },
    null,
    2,
  ));
}

main().catch((e) => {
  console.error("SMOKE TEST FAILED:", e.message);
  process.exit(1);
});