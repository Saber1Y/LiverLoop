# Liverloop

Liverloop is an autonomous multimodal media production loop that uses Livepeer to create media, evaluates and selectively improves its work, and preserves durable lessons through OriginTrail DKG.

## Hackathon Track

**Track 2: Livepeer Agent + OriginTrail DKG**

The chosen track combines the Livepeer Agent capability network with the OriginTrail Decentralized Knowledge Graph.

Liverloop is the loop that connects the two.

Livepeer generates the media.

OriginTrail preserves the prompt history and evaluation lessons from every production run.

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
Knowledge extraction -> DKG V10 API -> DKG V10 Base Testnet UAL
```

Liverloop runs a local OriginTrail DKG V10 node and publishes through the node's HTTP API.

The node owns the publishing wallet and submits the transaction to Base Sepolia.

The published UAL resolves on-chain through the local node and is verified in-app against the DKG Hub.

## Livepeer

Liverloop discovers capabilities from `https://agent.livepeer.org/api/capabilities`.

It executes capabilities through the Livepeer Agent MCP raw endpoint at `https://agent.livepeer.org/api/mcp/raw`.

The integration uses the MCP JSON-RPC `run_capability` tool and polls asynchronous jobs through `get_create_media`.

The client does not hard-code a fixed model sequence.

The Director selects only capabilities returned by the live network.

Every completed capability call records the returned artifact URL and `cost_usd_estimated` value.

The API key is read server-side from `LIVEPEER_API_KEY` when configured.

## OriginTrail DKG

The project uses the OriginTrail DKG **V10** API against a local DKG V10 Base Testnet node.

The local node is configured for the `testnet` network, which resolves to the DKG V10 Base Testnet deployed on Base Sepolia (`base:84532`).

The node owns its own wallet and does not require an application-level private key.

Application configuration only points at the node endpoint, port, context graph, and blockchain.

The published public asset contains the brief, iteration scores, source references, generation history, transformation history, final version, decision rationale, and reusable lessons.

Publication returns the real UAL and network when OriginTrail completes the operation.

Future runs load locally indexed published UALs and retrieve their public content from OriginTrail before planning.

If DKG publication or retrieval fails, the media run remains honest about that failure and does not display a fabricated UAL.

### Published to the DKG testnet

Each published `MediaRunKnowledgeAsset` contains:

- The **creative brief** (the prompt history).
- The **iteration history**: for each version, the evaluation scores, failure descriptions, and how the artifact was improved.
- The **final version** selected for the run.
- **Reusable lessons** learned during the run, retrieved by future runs.
- Public **artifact URLs** for generated media.
- **Generation history** with the capability, purpose, and real cost used per version.
- **Transformation history** showing which fixes were applied and why.
- The **decision rationale** of the Director and Critic.

### Remains local only

- Raw media files on disk (only public artifact URLs are published).
- The full run ledger event history in the local SQLite database.
- Internal agent messages and orchestration state.
- Credentials, API keys, and private keys.
- The DKG node's publishing wallet and keystore.

## Setup

Requirements:

- Node.js 20 or newer.
- A running OriginTrail DKG V10 node (testnet, Base Sepolia) on `http://127.0.0.1:9200`.
- A Livepeer Agent credential or an available Livepeer Agent demo-credit account.
- OpenRouter (or a compatible) API key for the Director, Critic, and extraction LLM calls.

### Start the DKG V10 node

Install the DKG V10 node package globally:

```bash
npm install -g @origintrail-official/dkg
```

Create the node configuration directory:

```bash
dkg init
```

Choose the `testnet` network (DKG V10 Base Testnet) and an `edge` node role.

Start the node:

```bash
dkg start
```

Check that it is listening on port 9200:

```bash
dkg status
```

The local node directory is `~/.dkg`.

The node's agent wallet is created on first start.

Top up the node's agent wallet with Base Sepolia test ETH and test TRAC so the node can cover gas and TRAC fees for publication.

### Run Liverloop

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

### Run Liverloop from OpenCode

The same setup works from the OpenCode terminal inside the repo.

Opencode can run the node, the app, and the validation commands for you as long as:

- The DKG V10 node is running on `127.0.0.1:9200`.
- `.env.local` contains real values.
- `npm install` and `npm run db:push` succeeded.

## Environment Variables

```env
LIVEPEER_API_KEY=...
DKG_ENDPOINT=http://127.0.0.1
DKG_PORT=9200
DKG_CONTEXT_GRAPH=0xc376B7120f0F895a7853cc445B7b139374e1c0f8/liverloop
DKG_BLOCKCHAIN=base:84532
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=nex-agi/nex-n2.5-pro:free
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Multiple LLM providers are optional:

```env
# OPENROUTER_API_KEY_2=sk-or-v1-yyy
# GROQ_API_KEY=gsk_xxx
# XAI_API_KEY=xai_xxx
```

Model overrides are optional:

```env
# OPENROUTER_MODEL_PLANNER=...
# OPENROUTER_MODEL_CRITIC=...
# OPENROUTER_FAST_MODEL=...
# OPENROUTER_VISION_MODEL=...
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
- The UAL returned by the DKG V10 node.
- On-chain verification against the DKG V10 Base Testnet Hub contract.
- A link to the publishing agent on Basescan.

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

- The Critic Agent currently evaluates only visual contrast from a small sample of frames extracted from the artifact; it does not yet judge deeper qualities such as pacing, tone, composition beyond contrast, or cross-section continuity. A future vision-specific critic can pass native image or video inputs to a multimodal model.
- The orchestration request currently runs in the application process and needs a durable worker for production deployment.
- The first UI version renders the returned artifact URL and does not yet provide a full media editor.
- OriginTrail publication requires the local DKG V10 node to be running, reachable, and its wallet funded with Base Sepolia test ETH and test TRAC.
- DKG testnet publication does not burn testnet TRAC, so testnet publishes are counted as simulated on the testnet; on the DKG mainnet they would be fully paid and on-chain.
- OpenRouter free models can be rate-limited or unavailable, so the configured model can be changed through the environment.