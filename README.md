# Liverloop

Liverloop is an autonomous multimodal media production loop that uses Livepeer to create media, evaluates and selectively improves its work, and preserves durable lessons through OriginTrail DKG.

## Product Loop

```text
Generate -> Evaluate -> Diagnose -> Improve -> Verify -> Remember
```

The Director converts a creative brief into a production plan.

Livepeer executes the selected capabilities from its live capability network.

The Critic evaluates generated artifacts against the brief.

The Director retries only the steps associated with failed dimensions.

The Run Ledger stores the detailed execution history.

The knowledge extractor publishes a selected `MediaRunKnowledgeAsset` to OriginTrail.

Future runs retrieve published lessons and pass them into the next Director plan.

## Architecture

```text
Next.js UI
    |
Run API + SQLite/Drizzle ledger
    |
Director -> Livepeer Agent -> Media artifacts
    |             |
    |             +-> real capability cost and output URL
    |
Critic -> structured evaluation -> targeted retry
    |
Knowledge extraction -> dkg.js V8 -> OriginTrail testnet UAL
```

## Livepeer

Liverloop discovers capabilities from `https://agent.livepeer.org/api/capabilities`.

It executes capabilities through the Livepeer Agent MCP raw endpoint at `https://agent.livepeer.org/api/mcp/raw`.

The integration uses the MCP JSON-RPC `run_capability` tool and polls asynchronous jobs through `get_create_media`.

The client does not hard-code a fixed model sequence.

The Director selects only capabilities returned by the live network.

Every completed capability call records the returned artifact URL and `cost_usd_estimated` value.

The API key is read server-side from `LIVEPEER_API_KEY` when configured.

## OriginTrail

The project uses `dkg.js` version 8 against an OriginTrail testnet node.

The published public asset contains the brief, iteration scores, source references, generation history, transformation history, final version, decision rationale, and reusable lessons.

Raw media, credentials, private keys, and unnecessary logs are not published.

Publication returns the real UAL and network when OriginTrail completes the operation.

Future runs load locally indexed published UALs and retrieve their public content from OriginTrail before planning.

If DKG publication or retrieval fails, the media run remains honest about that failure and does not display a fabricated UAL.

## Setup

Requirements:

- Node.js 20 or newer.
- A Livepeer Agent credential or available Livepeer Agent demo-credit account.
- An OriginTrail V8-compatible testnet node configuration.
- A Base Sepolia wallet with test ETH and test TRAC for publication.

Install dependencies:

```bash
npm install
```

Create the local environment file:

```bash
cp .env.example .env.local
```

Fill in all real values in `.env.local`.

Initialize the SQLite schema:

```bash
npm run db:push
```

Start the application:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

```env
LIVEPEER_API_KEY=...
DKG_ENDPOINT=https://v6-pegasus-node-02.origin-trail.network
DKG_PORT=8900
DKG_PRIVATE_KEY=0x...
DKG_BLOCKCHAIN=base:84532
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=nex-agi/nex-n2.5-pro:free
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Never commit `.env.local`, private keys, API keys, or wallet secrets.

## Golden Path

1. Open the landing page and select `Start a run`.
2. Enter a real media brief with a format, duration, audience, style, and CTA.
3. Submit the brief to create a persistent run ledger entry.
4. Liverloop discovers current Livepeer capabilities and asks the Director for a structured plan.
5. Livepeer generates the selected artifacts and returns real output URLs and costs.
6. The Critic evaluates the artifacts and records dimension scores and issues.
7. If the result fails, the Director chooses the smallest useful retry.
8. The dashboard shows preserved artifacts, new versions, score changes, and retry rationale.
9. The completed run extracts knowledge and attempts real OriginTrail publication.
10. Open `Provenance` to inspect the run timeline.
11. Open `Knowledge` to inspect the stored asset status and UAL when publication succeeds.
12. Start another run to retrieve prior OriginTrail lessons and influence the next Director plan.

## Verification Evidence

Livepeer evidence is visible in the run ledger and artifact metadata.

The dashboard labels generated artifacts as `REAL / LIVEPEER` and displays the returned cost.

OriginTrail evidence is visible in the knowledge page and includes:

- Publication status.
- Testnet name.
- UAL returned by `dkg.js`.
- The run event recording publication status and any transaction hash returned by the SDK.

The repository does not fabricate UALs or claim verification when the external publication fails.

## Validation Commands

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run db:push
npx tsx src/lib/livepeer/smoke.ts
```

The Livepeer smoke script performs a real `flux-schnell` generation and prints the returned URL and cost.

## Known Limitations

- The orchestration request currently runs in the application process and needs a durable worker for production deployment.
- The first UI version renders the returned artifact URL and does not yet provide a full media editor.
- Critic evaluation receives artifact metadata and a supplied description; a future vision-specific critic can pass native image or video inputs to a multimodal model.
- OriginTrail publication requires a funded testnet wallet and a reachable compatible node.
- OpenRouter free models can be rate-limited or unavailable, so the configured model can be changed through the environment.
