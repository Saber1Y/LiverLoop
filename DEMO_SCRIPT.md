# Liverloop - Demo Script

A prepared walkthrough for recording or presenting Liverloop live.

Target: ~3 minutes, Track 2 (Livepeer Agent + OriginTrail DKG).

## The one-paragraph pitch

A user types a media brief. The Director turns it into a production plan, pulls remembered lessons from previously published DKG knowledge assets, picks a real Livepeer capability, and generates the artifact. The Critic scores it against the brief. The Director retries only the failed dimension to save compute. On completion, the extractor turns the run into a `MediaRunKnowledgeAsset` - brief, iteration scores and failures, final version, up to 8 lessons, artifact URLs, costs, and rationale - and publishes it to the DKG V10 Base Testnet, which runs on Base Sepolia, through a local DKG node.

The loop: Generate -> Evaluate -> Diagnose -> Improve -> Verify -> Remember.

## Ground truth for the demo

- 68 recorded runs.
- 18 knowledge assets: 16 published (UALs `/13` through `/28`), 2 honestly marked failed.
- Star asset: run `u6B0PmjPVTuO`, UAL `did:dkg:base:84532/0xc376b7120f0f895a7853cc445b7b139374e1c0f8/28`, published 2026-09-21.
  - Brief: 15-second vertical launch video for Base announcing the onchain identity launch, CTA "Ship with Base" at the top of the frame, large bright white text with dark outline, visible only in the final 2 seconds.
  - v1 critique: visual 7 / audio 5 / messaging 4 / cta 2 / format 10 / pacing 6.
  - v1 failure: CTA at the bottom instead of the top, text cut off on the right edge.
  - Final version: v3.
  - Six extracted lessons: safe-zone margins for vertical, CTA/logo separation, maintain high-contrast cinematic style, confirm readability before export, etc.
- Publishing agent EOA: `0xc376B7120f0F895a7853cc445B7b139374e1c0f8`, 11 real on-chain transactions, verifiable on Basescan at `https://sepolia.basescan.org/address/0xc376B7120f0F895a7853cc445B7b139374e1c0f8`.

## Beat 1 - Landing (20 seconds)

Open the landing page.

Read the hero: "Generate. Evaluate. Improve. Remember."

Line: "Liverloop is a self-correcting media engine. It critiques its own output, repairs only what failed, and anchors production memory to the OriginTrail DKG."

Scroll the 4-step loop: CREATE / EVALUATE / IMPROVE / REMEMBER.

## Beat 2 - Run history (25 seconds)

Open `/runs` (Production history).

Line: "Every run, in context. 68 runs, each recording brief, iterations, real Livepeer costs, and a full event history. No mocked numbers: every cost is the `cost_usd_estimated` value Livepeer actually returned."

Point at a recent run card showing status, brief, format, version badge, event count, and cost.

## Beat 3 - The live run (60-90 seconds)

Open `/run/new`. This is the money shot - do it live.

Type a fresh brief into the floating command bar and send it.

Narrate the phase pipeline as it streams in:

- Planning - Director turns the brief into a production plan.
- Memory retrieval - pop the "Memory retrieved" block showing lessons pulled from prior DKG assets and injected into this plan.
- Capability selection - choosing the next real Livepeer capability.
- Livepeer generation - generating the first real media artifact.
- Evaluation - watch Visuals / Pacing / CTA scores land from the Critic.
- Improvement - "it re-generates only the failed dimension to save compute."
- Knowledge publication - the durable lesson goes to OriginTrail.

Let the central artifact render. Download the final video if applicable.

## Beat 4 - DKG proof / knowledge (40 seconds)

Open `/knowledge` (What Liverloop remembers).

Pick the `/28` asset and press Verify live.

The panel shows: Verified on-chain - base:84532, memory layer, published UAL, assertion.

Click "View publishing agent on Basescan."

Line: "The Knowledge Asset is verifiable on the DKG V10 Base Testnet, which runs on Base Sepolia. Here is the publishing agent doing real transactions."

Optional: briefly show a failed asset marked honestly as "Publication failed" to prove no UAL fabrication.

## Beat 5 - Provenance (20 seconds)

Open the star run in `/provenance/<runId>`.

Scroll the event timeline: plan created, capability selected, jobs, critique, retry, knowledge extracted, knowledge published.

## Beat 6 - Close (15 seconds)

Line: "Liverloop is a full closed loop. Livepeer produces, the Critic judges, the Director improves, and the DKG remembers - so the next run starts smarter than the last."

State it loud: Track 2: Livepeer Agent + OriginTrail DKG.

## Honesty guardrails

- Always say "Base Sepolia testnet", never "mainnet".
- 2 of 18 assets failed publication and are marked honestly. If asked: that is a feature. The app never fabricates a UAL.
- Testnet publishes do not create a per-asset transaction hash (they are simulated, no TRAC is burned). The strongest on-chain proof is the agent EOA's real transaction history on Basescan plus the live in-app verification against the node.
- The deployed app at `https://liverloop.onrender.com` reads the environment through `NEXT_PUBLIC_APP_URL` and uses whatever DKG node is configured by `DKG_ENDPOINT` / `DKG_PORT`. Verify against the environment that is actually running.

## Pre-record checklist

1. Do a fresh live run once first so timing, cost, and behavior are known.
2. Confirm the hackathon attribution / tracking requirement.
3. Commit and push the repo so the deployed code matches the recorded demo.