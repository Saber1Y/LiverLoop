"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  DatabaseZap,
  Play,
  ScanSearch,
  Sparkles,
  XCircle,
  Terminal,
  Activity,
  Users,
  Code,
  Gamepad2,
} from "lucide-react";

// --- Navigation Components ---
const NavLink = ({ href, label }: { href: string; label: string }) => (
  <Link
    href={href}
    className="px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
  >
    {label}
  </Link>
);

const LogoText = () => (
  <div className="flex items-center gap-2">
    <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[0_0_15px_rgba(200,245,106,0.3)]">
      <span className="size-2 rounded-full bg-current" />
    </span>
    <span className="font-mono text-sm font-semibold tracking-[0.18em] text-foreground">
      LIVERLOOP
    </span>
  </div>
);

function LandingNav() {
  return (
    <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2">
      <motion.nav
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex w-[min(920px,calc(100vw-2rem))] items-center rounded-full border border-border bg-background/80 py-2.5 pl-4 pr-2 shadow-2xl shadow-black/20 backdrop-blur-xl sm:pl-5 sm:pr-2">
          {/* Left: Logo */}
          <Link href="/" className="flex shrink-0 items-center">
            <LogoText />
          </Link>

          {/* Center: Links */}
          <div className="mx-2 hidden min-w-0 flex-1 items-center justify-center lg:flex">
            <NavLink href="#architecture" label="Architecture" />
            <NavLink href="#terminal" label="Agent Log" />
            <NavLink href="#provenance" label="DKG Proof" />
            <NavLink href="#ledger" label="Cost Control" />
            <NavLink href="/runs" label="Runs" />
          </div>

          {/* Right: Actions */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              Testnet Live
            </button>
            <Link
              href="/run/new"
              className="group flex items-center gap-2 whitespace-nowrap rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-all hover:scale-105 hover:bg-foreground/90"
            >
              Launch App
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </motion.nav>
    </div>
  );
}

// --- Data Constants ---
const loop = [
  {
    index: "01",
    label: "CREATE",
    detail: "Director maps the brief to real media capabilities.",
  },
  {
    index: "02",
    label: "EVALUATE",
    detail: "Critic scores the outcome against the intended message.",
  },
  {
    index: "03",
    label: "IMPROVE",
    detail: "Only the failed part is sent back through compute.",
  },
  {
    index: "04",
    label: "REMEMBER",
    detail: "The useful lesson becomes verifiable knowledge.",
  },
];

type PublishedKnowledgeAsset = {
  runId: string;
  ual: string | null;
  network: string | null;
  status: string;
  publishedAt: string | null;
  content: {
    lessons: string[];
    sourceReferences: string[];
  };
};

// --- Main Page ---
export default function Home() {
  const [proof, setProof] = useState<PublishedKnowledgeAsset[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/knowledge", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() as Promise<{ assets: PublishedKnowledgeAsset[] }> : null))
      .then((data) => {
        if (active && data) setProof(data.assets);
      })
      .catch(() => {
        // The landing page remains usable when the local ledger is unavailable.
      });

    return () => {
      active = false;
    };
  }, []);

  const latestProof = proof[0];

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-background selection:bg-primary/30">
      <LandingNav />

      {/* HERO SECTION */}
      <section className="hairline-grid relative mx-auto grid min-h-[100dvh] w-full max-w-[1400px] items-center gap-16 px-5 pb-20 pt-32 md:grid-cols-[1.02fr_0.98fr] md:px-10">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-7 font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
            Agent-Native Media Studio / 01
          </p>

          <h1 className="max-w-[700px] text-5xl font-semibold leading-[0.97] tracking-[-0.065em] text-foreground sm:text-6xl md:text-7xl">
            Generate.
            <br />
            Evaluate.
            <br />
            <span className="relative z-10 inline-block whitespace-nowrap text-background before:absolute before:-inset-x-[0.25em] before:-inset-y-[0.1em] before:-z-10 before:-rotate-2 before:rounded-[3px] before:bg-primary">
              Improve.
            </span>
            <br />
            Remember.
          </h1>

          <p className="mt-8 max-w-lg text-lg leading-relaxed text-muted-foreground">
            The first self-correcting media engine. Liverloop critiques its own
            output, repairs only what failed to save compute, and anchors
            verified production memory to the DKG.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/run/new"
              className="group inline-flex h-12 items-center gap-3 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_rgba(200,245,106,0.2)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(200,245,106,0.4)] active:translate-y-0"
            >
              Start Production{" "}
              <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#loop"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-border px-6 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
            >
              <Play className="size-3.5 fill-current" /> Watch the loop
            </a>
          </div>
        </div>

        {/* Hero Visualizer */}
        <div className="relative mx-auto w-full max-w-[560px] md:ml-auto">
          <div className="absolute -inset-10 rounded-full bg-primary/[0.08] blur-[100px]" />
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card/80 shadow-2xl shadow-black/40 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-border bg-background/50 px-5 py-4">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />{" "}
                Live production
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                RUN / 014
              </span>
            </div>
            <div className="grid gap-0 sm:grid-cols-[1fr_1.15fr]">
              <div className="border-b border-border bg-card/50 p-5 sm:border-b-0 sm:border-r">
                <div className="mb-8 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Director activity
                </div>
                <div className="space-y-5">
                  <ActivityRow
                    icon={<BrainCircuit className="size-4" />}
                    label="understood brief"
                    state="complete"
                  />
                  <ActivityRow
                    icon={<Sparkles className="size-4" />}
                    label="selected video gen"
                    state="complete"
                  />
                  <ActivityRow
                    icon={<ScanSearch className="size-4" />}
                    label="critic reviewing"
                    state="active"
                  />
                  <ActivityRow
                    icon={<DatabaseZap className="size-4" />}
                    label="knowledge pending"
                    state="pending"
                  />
                </div>
              </div>
              <div className="bg-card/20 p-5">
                <div className="mb-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <span>Current artifact</span>
                  <span className="font-semibold text-primary">V1</span>
                </div>
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-primary/20 bg-[#0a0f0e]">
                  <div
                    className="absolute inset-0 opacity-70"
                    style={{
                      background:
                        "radial-gradient(circle at 65% 35%, rgba(200,245,106,.15), transparent 40%), linear-gradient(135deg, #111a18, #050809 70%)",
                    }}
                  />
                  <div className="absolute inset-x-4 bottom-4">
                    <div className="mb-2 h-px w-2/3 bg-primary/50" />
                    <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary/80">
                      media / eval / memory
                    </div>
                  </div>
                  <div className="absolute right-4 top-4 rounded border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[8px] text-primary backdrop-blur-sm">
                    LIVEPEER
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[10px]">
                  <Metric label="Visual" value="LIVE" />
                  <Metric label="Message" value="PENDING" warning />
                  <Metric label="Cost" value="LIVE" />
                </div>
              </div>
            </div>
          </div>
          <p className="relative mt-4 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60">
            real work / visible decisions / durable memory
          </p>
        </div>
      </section>

      {/* ARCHITECTURE SECTION */}
      <section
        id="architecture"
        className="relative mx-auto w-full max-w-[1400px] border-t border-border px-5 py-24 md:px-10 md:py-32"
      >
        <div className="max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
            System Architecture
          </p>
          <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] md:text-5xl">
            A production team, not a prompt box.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            We combined Livepeer&apos;s decentralized compute with OriginTrail&apos;s
            Knowledge Graph to build a multi-agent system that actually learns
            from its mistakes.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: BrainCircuit,
              title: "Director Agent",
              desc: "Interprets briefs, drafts media plans, and isolates failure points to issue minimal-cost correction commands.",
            },
            {
              icon: Sparkles,
              title: "Livepeer Compute",
              desc: "Executes cost-optimized generation and deterministic editing (FFmpeg) via decentralized GPU orchestrators.",
            },
            {
              icon: ScanSearch,
              title: "Critic Agent",
              desc: "Evaluates multimodal outputs against the original brief, scoring visual quality, audio cadence, and script alignment.",
            },
            {
              icon: DatabaseZap,
              title: "OriginTrail DKG",
              desc: "Anchors the final asset and its production history to the testnet, transforming transient context into durable knowledge.",
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card/50 p-8 transition-all hover:border-primary/30 hover:bg-card hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="mb-5 inline-flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110 group-hover:bg-primary/20">
                <feature.icon className="size-6" />
              </div>
              <h3 className="mb-3 text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* NEW: AGENTIC TERMINAL LOGS */}
      <section
        id="terminal"
        className="mx-auto w-full max-w-[1400px] border-t border-border px-5 py-24 md:px-10 md:py-32"
      >
        <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
              Live Decision Logs
            </p>
            <h2 className="mt-5 text-3xl font-semibold tracking-[-0.05em] md:text-4xl">
              See how the agents reason.
            </h2>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 font-mono text-[10px] text-muted-foreground">
            <Activity className="size-3 text-primary" /> Real run ledger
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-[#09090b] shadow-2xl">
          {/* Terminal Header */}
          <div className="flex items-center gap-2 border-b border-border/50 bg-[#121214] px-4 py-3">
            <div className="flex gap-1.5">
              <div className="size-2.5 rounded-full bg-red-500/80" />
              <div className="size-2.5 rounded-full bg-yellow-500/80" />
              <div className="size-2.5 rounded-full bg-green-500/80" />
            </div>
            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
              agent_orchestrator_01.log
            </span>
          </div>

          {/* Terminal Content */}
          <div className="p-6 font-mono text-[13px] leading-relaxed md:p-8">
            <div className="text-muted-foreground">
              <span className="text-blue-400">RUN_CREATED</span>{" "}
              Brief accepted and persisted to the run ledger.
            </div>
            <div className="text-muted-foreground">
              <span className="text-blue-400">CAPABILITY_SELECTED</span>{" "}Dispatching
              a discovered capability to{" "}
              <span className="text-primary/80">Livepeer (Text-to-Video)</span>
            </div>
            <div className="text-muted-foreground">
              <span className="text-green-400">ARTIFACT_CREATED</span> Real output
              returned. Passing it to the Critic.
            </div>
            <div className="mt-4 text-foreground/80">
              <span className="text-purple-400 font-semibold">
                &gt; CRITIC_AGENT:
              </span>{" "}
              Evaluating visual structure... [CRITIC SCORE]
            </div>
            <div className="text-foreground/80">
              <span className="text-purple-400 font-semibold">
                &gt; CRITIC_AGENT:
              </span>{" "}
              Evaluating CTA frame...
            </div>
            <div className="text-red-400">
              <span className="text-red-400">ISSUE_DETECTED</span>{" "}
              <span className="font-semibold text-red-500">WARN</span> CTA text
              illegible in final frame. Brief requires clear text.
            </div>
            <div className="mt-4 text-foreground/80">
              <span className="text-amber-400 font-semibold">
                &gt; DIRECTOR_AGENT:
              </span>{" "}
              Analyzing failure mode...
            </div>
            <div className="text-foreground/80">
              <span className="text-amber-400 font-semibold">
                &gt; DIRECTOR_AGENT:
              </span>{" "}
              Bypassing full generative retry to save compute.
            </div>
            <div className="text-muted-foreground">
              <span className="text-blue-400">DIRECTOR_DECISION</span> Routing V1
              + overlay command to{" "}
              <span className="text-primary/80">
                Livepeer (FFmpeg deterministic)
              </span>
            </div>
            <div className="text-muted-foreground animate-pulse mt-2">
              <span className="text-primary">_</span> awaiting the next real run...
            </div>
          </div>
        </div>
      </section>

      {/* NEW: COST-AWARE EXECUTION LEDGER */}
      <section
        id="ledger"
        className="mx-auto w-full max-w-[1400px] border-t border-border px-5 py-24 md:px-10 md:py-32"
      >
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.05em] md:text-4xl">
            Surgical execution saves compute.
          </h2>
          <p className="mt-4 text-muted-foreground">
            By analyzing failures before retrying, Liverloop protects treasury
            budgets from infinite AI loops.
          </p>
        </div>

        <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid grid-cols-[1.5fr_1fr_1fr] border-b border-border bg-muted/30 p-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground md:px-8 md:py-5">
            <div>Metric</div>
            <div>Standard AI Wrapper</div>
            <div className="text-primary">Liverloop Pipeline</div>
          </div>

          {[
            {
              label: "Failure Response",
              bad: "Full video regeneration",
              good: "Surgical layer replacement",
            },
            {
              label: "API Calls (per fix)",
              bad: "Heavy generative calls",
              good: "1 localized call + 1 muxing pass",
            },
            {
              label: "Compute Cost",
              bad: "Full regeneration cost",
              good: "Livepeer-reported targeted cost",
            },
            {
              label: "Treasury Control",
              bad: "Infinite loop drain risk",
              good: "Hard limits enforced per session",
            },
          ].map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-[1.5fr_1fr_1fr] items-center border-b border-border/50 p-4 text-sm md:px-8 md:py-5 last:border-0 hover:bg-muted/10 transition-colors"
            >
              <div className="font-medium text-foreground">{row.label}</div>
              <div className="text-muted-foreground">{row.bad}</div>
              <div className="flex items-center gap-2 text-primary font-medium">
                <CheckCircle2 className="size-4 shrink-0" /> {row.good}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* NEW: PROVENANCE TIMELINE (DKG) */}
      <section
        id="provenance"
        className="mx-auto w-full max-w-[1400px] border-t border-border px-5 py-24 md:px-10 md:py-32"
      >
        <div className="max-w-2xl mb-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
            Track 2: OriginTrail DKG
          </p>
          <h2 className="mt-5 text-3xl font-semibold tracking-[-0.05em] md:text-4xl">
            From transient context to durable knowledge.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            We don&apos;t just use the DKG as a database. We anchor the entire
            iterative history—prompts, critiques, and final assets—to the
            testnet so future agents can learn from past mistakes.
          </p>
        </div>

        <div className="relative mx-auto max-w-5xl">
          {/* Connecting Line */}
          <div className="absolute left-[27px] top-4 h-[calc(100%-3rem)] w-px border-l-2 border-dashed border-border md:left-1/2 md:-ml-px" />

          <div className="space-y-12">
            {[
              {
                title: "Brief Submitted",
                desc: "User requests a 10s cinematic trailer.",
                icon: Terminal,
                side: "left",
              },
              {
                title: "Draft 1 Generated",
                desc: "Livepeer processes initial text-to-video prompt.",
                icon: Sparkles,
                side: "right",
              },
              {
                title: "Critic Intervention",
                desc: "Agent flags low contrast on final CTA.",
                icon: ScanSearch,
                side: "left",
              },
              {
                title: "Targeted Correction",
                desc: "Director uses FFmpeg to correct contrast only.",
                icon: BrainCircuit,
                side: "right",
              },
            ].map((node, i) => (
              <div
                key={i}
                className={`relative flex items-center gap-6 md:justify-between ${node.side === "left" ? "md:flex-row-reverse" : ""}`}
              >
                <div
                  className={`hidden w-5/12 md:block ${node.side === "left" ? "text-left" : "text-right"}`}
                />

                {/* Node Dot */}
                <div className="relative z-10 flex size-[54px] shrink-0 items-center justify-center rounded-full border border-border bg-card shadow-sm md:absolute md:left-1/2 md:-translate-x-1/2">
                  <node.icon className="size-5 text-muted-foreground" />
                </div>

                {/* Node Content */}
                <div
                  className={`w-full md:w-5/12 ${node.side === "left" ? "md:text-right" : "md:text-left"}`}
                >
                  <h4 className="text-base font-semibold">{node.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {node.desc}
                  </p>
                </div>
              </div>
            ))}

            {/* Final DKG Node */}
            <div className="relative flex items-center gap-6 md:justify-center mt-8">
              <div className="relative z-10 flex w-full max-w-md flex-col items-center rounded-2xl border border-primary/40 bg-primary/5 p-8 text-center shadow-[0_0_40px_rgba(200,245,106,0.1)] backdrop-blur-sm">
                <DatabaseZap className="mb-4 size-8 text-primary drop-shadow-[0_0_8px_rgba(200,245,106,0.5)]" />
                <h4 className="text-lg font-semibold text-foreground">
                  Knowledge Asset
                </h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  A real asset is published to OriginTrail after a completed run.
                </p>
                <div className="mt-6 w-full rounded-lg border border-primary/20 bg-background/50 p-4 text-left font-mono text-[10px] text-muted-foreground">
                  {latestProof ? (
                    <>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-primary">PUBLICATION STATUS</span>
                        <span className="flex items-center gap-1.5 text-primary">
                          <CheckCircle2 className="size-3" /> VERIFIED
                        </span>
                      </div>
                      <div className="grid gap-2 border-b border-border/60 pb-3 sm:grid-cols-3">
                        <div>
                          <span className="block text-muted-foreground/70">PUBLISHED RUNS</span>
                          <span className="mt-1 block text-sm text-foreground">{proof.length}</span>
                        </div>
                        <div>
                          <span className="block text-muted-foreground/70">LESSONS RETAINED</span>
                          <span className="mt-1 block text-sm text-foreground">{latestProof.content.lessons.length}</span>
                        </div>
                        <div>
                          <span className="block text-muted-foreground/70">NETWORK</span>
                          <span className="mt-1 block text-sm text-foreground">{latestProof.network ?? "unavailable"}</span>
                        </div>
                      </div>
                      <div className="mt-3">
                        <span className="block text-muted-foreground/70">LATEST UAL</span>
                        <span className="mt-1 block break-all text-primary/90">{latestProof.ual ?? "unavailable"}</span>
                      </div>
                      {latestProof.content.sourceReferences[0] ? (
                        <a
                          href={latestProof.content.sourceReferences[0]}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex items-center gap-1.5 text-primary transition-colors hover:text-foreground"
                        >
                          Open latest Livepeer artifact <ArrowUpRight className="size-3" />
                        </a>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div className="mb-1 text-primary">PUBLICATION STATUS:</div>
                      <div className="break-all">Waiting for a published run and verified UAL</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THE LOOP SECTION */}
      <section
        id="loop"
        className="mx-auto w-full max-w-[1400px] border-t border-border px-5 py-24 md:px-10 md:py-32"
      >
        <div className="max-w-xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
            The operating loop
          </p>
          <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] md:text-5xl">
            Generation is only the first decision.
          </h2>
        </div>
        <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-border bg-border shadow-xl md:grid-cols-4">
          {loop.map((item, index) => (
            <div
              key={item.index}
              className={`min-h-[280px] p-8 transition-colors ${
                index === 2
                  ? "bg-primary text-primary-foreground"
                  : "bg-card hover:bg-background"
              }`}
            >
              <div
                className={`font-mono text-xs font-semibold tracking-wider ${
                  index === 2
                    ? "text-primary-foreground/60"
                    : "text-muted-foreground"
                }`}
              >
                {item.index}
              </div>
              <div className="mt-24 text-3xl font-semibold tracking-tight">
                {item.label}
              </div>
              <p
                className={`mt-4 text-sm leading-relaxed ${
                  index === 2
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground"
                }`}
              >
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* THE HACKATHON EDGE */}
      <section
        id="edge"
        className="mx-auto w-full max-w-[1400px] border-t border-border px-5 py-24 md:px-10 md:py-32"
      >
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-semibold tracking-[-0.05em] md:text-5xl">
            Why Liverloop wins.
          </h2>
          <p className="mt-4 text-muted-foreground">
            The difference between a wrapper and an autonomous workflow.
          </p>
        </div>
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
          {/* Bad Example */}
          <div className="flex flex-col rounded-3xl border border-border bg-card/40 p-8 sm:p-10">
            <h3 className="mb-8 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Standard AI Wrapper
            </h3>
            <ul className="space-y-6 text-base text-muted-foreground">
              <li className="flex items-start gap-4">
                <XCircle className="mt-0.5 size-5 shrink-0 text-destructive/70" />{" "}
                Blindly regenerates whole files on failure
              </li>
              <li className="flex items-start gap-4">
                <XCircle className="mt-0.5 size-5 shrink-0 text-destructive/70" />{" "}
                Unpredictable API compute costs
              </li>
              <li className="flex items-start gap-4">
                <XCircle className="mt-0.5 size-5 shrink-0 text-destructive/70" />{" "}
                Relies entirely on manual user critique
              </li>
              <li className="flex items-start gap-4">
                <XCircle className="mt-0.5 size-5 shrink-0 text-destructive/70" />{" "}
                Starts from zero context every session
              </li>
            </ul>
          </div>
          {/* Good Example */}
          <div className="relative flex flex-col rounded-3xl border border-primary/30 bg-primary/5 p-8 shadow-[0_0_50px_rgba(200,245,106,0.05)] sm:p-10">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 to-transparent opacity-50" />
            <h3 className="relative z-10 mb-8 font-mono text-xs font-semibold uppercase tracking-widest text-primary">
              Liverloop Pipeline
            </h3>
            <ul className="relative z-10 space-y-6 text-base text-foreground">
              <li className="flex items-start gap-4">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary drop-shadow-[0_0_8px_rgba(200,245,106,0.5)]" />{" "}
                Surgical fixes (e.g., replace audio only) to save compute
              </li>
              <li className="flex items-start gap-4">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary drop-shadow-[0_0_8px_rgba(200,245,106,0.5)]" />{" "}
                Cost-aware Livepeer network routing
              </li>
              <li className="flex items-start gap-4">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary drop-shadow-[0_0_8px_rgba(200,245,106,0.5)]" />{" "}
                Autonomous multimodal evaluation agent
              </li>
              <li className="flex items-start gap-4">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary drop-shadow-[0_0_8px_rgba(200,245,106,0.5)]" />{" "}
                Retrieves verifiable past lessons via DKG
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* NEW: TARGET WEB3 WORKFLOWS */}
      <section
        id="use-cases"
        className="mx-auto w-full max-w-[1400px] border-t border-border px-5 py-24 md:px-10 md:py-32"
      >
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.05em] md:text-4xl">
            Built for Web3 infrastructure.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Who needs autonomous, provable media workflows today?
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Users,
              title: "DAO Marketing Guilds",
              desc: "Automate campaign variations based on community feedback without burning treasury funds on wasted Livepeer compute loops.",
            },
            {
              icon: Code,
              title: "Developer Relations",
              desc: "Convert technical repositories and changelogs into daily video summaries that are autonomously checked for technical accuracy.",
            },
            {
              icon: Gamepad2,
              title: "Indie Game Studios",
              desc: "Generate hundreds of game asset variations where the Critic agent strictly enforces visual style-guide consistency before render approval.",
            },
          ].map((useCase, i) => (
            <div
              key={i}
              className="flex flex-col rounded-2xl border border-border bg-card p-8"
            >
              <div className="mb-6 inline-flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <useCase.icon className="size-6" />
              </div>
              <h3 className="mb-3 text-lg font-semibold">{useCase.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {useCase.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* PROOF / FOOTER */}
      <footer
        id="proof"
        className="mx-auto w-full max-w-[1400px] border-t border-border px-5 py-12 md:px-10"
      >
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <LogoText />
          <div className="flex gap-6 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>© LIVERLOOP 2026</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">
              Built for Atumera Hackathon
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}

// --- Subcomponents ---

function ActivityRow({
  icon,
  label,
  state,
}: {
  icon: React.ReactNode;
  label: string;
  state: "complete" | "active" | "pending";
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span
        className={
          state === "complete"
            ? "text-primary"
            : state === "active"
              ? "text-foreground animate-pulse"
              : "text-muted-foreground/30"
        }
      >
        {icon}
      </span>
      <span
        className={
          state === "pending"
            ? "text-muted-foreground/40"
            : "font-medium text-foreground/90"
        }
      >
        {label}
      </span>
      <span
        className={`ml-auto font-mono text-[9px] uppercase tracking-wider ${state === "active" ? "text-primary" : "text-muted-foreground/60"}`}
      >
        {state}
      </span>
    </div>
  );
}

function Metric({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-border/50 bg-background/30 p-2.5 backdrop-blur-sm">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`font-mono text-sm font-semibold ${warning ? "text-amber-400" : "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}
