"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  Check,
  CircleAlert,
  CircleDashed,
  DatabaseZap,
  LoaderCircle,
  ScanSearch,
  Sparkles,
} from "lucide-react";

type RunData = {
  run: {
    id: string;
    brief: { objective: string; audience?: string; format?: string; duration?: number; style?: string; cta?: string };
    status: string;
    currentVersion: number;
    totalCost: number;
  };
  events: { id: string; type: string; data: Record<string, unknown>; createdAt: string; versionNumber: number | null }[];
  versions: {
    id: string;
    versionNumber: number;
    selected: boolean;
    evaluation: { overall: number; decision: string; dimensions: { name: string; score: number }[] } | null;
    artifacts: { id: string; type: string; url: string; capability: string; purpose: string; metadata: Record<string, unknown> }[];
  }[];
};

export function RunDashboard({ runId }: { runId: string }) {
  const [data, setData] = useState<RunData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const response = await fetch(`/api/run/${runId}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Run could not be loaded.");
        const next = await response.json() as RunData;
        if (active) { setData(next); setError(null); }
      } catch (pollError) {
        if (active) setError(pollError instanceof Error ? pollError.message : "Run could not be loaded.");
      }
    }
    void poll();
    const interval = window.setInterval(() => void poll(), 3000);
    return () => { active = false; window.clearInterval(interval); };
  }, [runId]);

  if (error && !data) return <MessageState title="Run unavailable" detail={error} />;
  if (!data) return <LoadingState />;

  const latest = data.versions.at(-1);
  const latestArtifact = latest?.artifacts.at(-1);
  const isActive = ["planning", "generating", "evaluating", "improving"].includes(data.run.status);
  const journey = getJourney(data);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#09090b] px-5 py-5 text-foreground md:px-10">
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)", backgroundSize: "32px 32px" }} />
      <div className="relative z-10 mx-auto max-w-[1400px]">
        <Header runId={runId} />

        <section className="grid gap-10 py-12 lg:grid-cols-[0.92fr_1.08fr] lg:py-16">
          <div className="flex flex-col justify-center">
            <StatusPill status={data.run.status} active={isActive} />
            <h1 className="mt-6 max-w-3xl text-xl font-semibold leading-[0.98] tracking-[-0.065em] md:text-2xl">{data.run.brief.objective}</h1>
            <div className="mt-8 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {data.run.brief.format ? <span className="rounded-full border border-border bg-card/60 px-3 py-1.5">{data.run.brief.format}</span> : null}
              {data.run.brief.duration ? <span className="rounded-full border border-border bg-card/60 px-3 py-1.5">{data.run.brief.duration}s</span> : null}
              {data.run.brief.audience ? <span className="rounded-full border border-border bg-card/60 px-3 py-1.5">{data.run.brief.audience}</span> : null}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 self-end"><RunMetric label="Version" value={latest ? `V${latest.versionNumber}` : "--"} /><RunMetric label="Livepeer cost" value={`$${data.run.totalCost.toFixed(4)}`} /><RunMetric label="Ledger events" value={String(data.events.length)} /></div>
        </section>

        <RunJourney journey={journey} />

        <section className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="rounded-2xl border border-border bg-card/65 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl md:p-7">
            <div className="mb-7 flex items-center justify-between"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"><Activity className="size-3.5 text-primary" /> Execution ledger</div><span className="font-mono text-[9px] text-primary">REAL / LIVE</span></div>
            <div className="space-y-1">{data.events.slice().reverse().map((event, index) => <EventRow key={event.id} event={event} active={isActive && index === 0} />)}</div>
            {data.events.length === 0 ? <p className="text-sm text-muted-foreground">Waiting for the Director.</p> : null}
          </div>
          <motion.div layout className="rounded-2xl border border-border bg-card/45 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl md:p-7">
            <div className="mb-7 flex items-center justify-between"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"><ScanSearch className="size-3.5 text-primary" /> Media artifact</div><span className="font-mono text-[9px] text-primary">{latest ? `V${latest.versionNumber}` : "WAITING"}</span></div>
            {latestArtifact ? <ArtifactPreview artifact={latestArtifact} /> : <EmptyArtifact active={isActive} activity={journey.current.detail} />}
          </motion.div>
        </section>

        {latest?.evaluation ? <EvaluationPanel evaluation={latest.evaluation} versions={data.versions} /> : <div className="mt-5 flex items-center gap-3 rounded-xl border border-dashed border-border px-5 py-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"><Sparkles className="size-3.5 text-primary" />{journey.current.index >= 3 ? "Critic is preparing the first evaluation." : "Critic review unlocks after the first real artifact."}</div>}
      </div>
    </main>
  );
}

function Header({ runId }: { runId: string }) {
  return <header className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-border bg-card/70 px-4 py-3 shadow-xl shadow-black/10 backdrop-blur-xl md:px-5"><Link href="/" className="flex items-center gap-3 font-mono text-sm tracking-[0.16em]"><span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><span className="size-2 rounded-full bg-current" /></span>LIVERLOOP</Link><div className="flex items-center gap-4"><Link href="/runs" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Runs</Link><Link href={`/provenance/${runId}`} className="text-xs text-muted-foreground transition-colors hover:text-foreground">Provenance</Link><Link href="/knowledge" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Knowledge</Link><Link href="/run/new" className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3" /> New run</Link></div></header>;
}

function StatusPill({ status, active }: { status: string; active: boolean }) {
  return <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"><span className={`size-1.5 rounded-full ${active ? "pulse-dot bg-primary" : status === "failed" ? "bg-red-400" : "bg-primary"}`} />{status}</div>;
}

function EventRow({ event, active }: { event: RunData["events"][number]; active: boolean }) {
  const failed = event.type === "RUN_FAILED";
  const retrieved = event.type === "KNOWLEDGE_RETRIEVED" && Array.isArray(event.data.lessons);
  const lessons = retrieved ? (event.data.lessons as unknown[]).map(String) : null;
  const ual = typeof event.data.ual === "string" ? event.data.ual : null;
  const detail = retrieved
    ? `${lessons?.length ?? 0} lesson${(lessons?.length ?? 0) === 1 ? "" : "s"} retained from prior run${ual ? ` - ${ual.split("/").at(-1)}` : ""}`
    : event.data.capability ? String(event.data.capability) : event.data.message ? String(event.data.message) : "System recorded this decision.";
  return <div className="flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-white/[0.03]"><span className={`mt-0.5 ${failed ? "text-red-300" : active ? "text-primary" : "text-muted-foreground"}`}>{failed ? <CircleAlert className="size-4" /> : event.type.includes("COMPLETED") || event.type.includes("CREATED") ? <Check className="size-4" /> : active ? <LoaderCircle className="size-4 animate-spin" /> : <CircleDashed className="size-4" />}</span><div className="min-w-0 flex-1"><p className="font-mono text-[10px] tracking-[0.1em] text-foreground/80">{event.type.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p>{lessons && lessons.length > 0 ? <ul className="mt-1.5 space-y-1 border-l border-primary/20 pl-2"><li key="root">{lessons.slice(0, 2).map((lesson, index) => <p key={index} className="text-[11px] leading-4 text-muted-foreground/85">- {lesson}</p>)}{lessons.length > 2 ? <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-muted-foreground/60">+ {lessons.length - 2} more</p> : null}</li></ul> : null}</div><time className="font-mono text-[9px] text-muted-foreground/60">{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>;
}

type JourneyPhase = {
  label: string;
  detail: string;
};

type JourneyState = {
  current: JourneyPhase & { index: number };
  phases: (JourneyPhase & { index: number; state: "done" | "current" | "upcoming" | "failed" })[];
  failedMessage?: string;
};

const journeyPhases: JourneyPhase[] = [
  { label: "Planning", detail: "Director is turning the brief into a production plan." },
  { label: "Memory retrieval", detail: "Checking DKG for lessons from previous runs." },
  { label: "Capability selection", detail: "Selecting the next real Livepeer capability." },
  { label: "Livepeer generation", detail: "Waiting for a real media artifact from Livepeer." },
  { label: "Evaluation", detail: "Critic is scoring the artifact against the brief." },
  { label: "Improvement", detail: "Director is deciding what to keep and regenerate." },
  { label: "Knowledge publication", detail: "Saving the lesson and publishing it to OriginTrail DKG." },
];

function getJourney(data: RunData): JourneyState {
  const chronological = data.events.slice().reverse();
  const latestEvent = chronological.at(-1);
  const latestType = latestEvent?.type === "RUN_FAILED" ? chronological.at(-2)?.type ?? "RUN_CREATED" : latestEvent?.type ?? "RUN_CREATED";
  const failed = data.run.status === "failed" || latestType === "RUN_FAILED";
  const failedMessage = failed && latestEvent?.type === "RUN_FAILED" && latestEvent.data.message
    ? String(latestEvent.data.message)
    : undefined;
  let currentIndex = 0;

  if (latestType === "KNOWLEDGE_RETRIEVED") currentIndex = 1;
  else if (["PLAN_CREATED"].includes(latestType)) currentIndex = 2;
  else if (["CAPABILITY_SELECTED", "JOB_STARTED", "JOB_COMPLETED", "ARTIFACT_CREATED"].includes(latestType)) currentIndex = 3;
  else if (["EVALUATION_STARTED", "EVALUATION_COMPLETED"].includes(latestType)) currentIndex = 4;
  else if (["DIRECTOR_DECISION", "RETRY_STARTED"].includes(latestType)) currentIndex = 5;
  else if (["KNOWLEDGE_EXTRACTED", "KNOWLEDGE_PUBLISHED", "RUN_COMPLETED"].includes(latestType)) currentIndex = 6;

  if (data.run.status === "completed") currentIndex = 6;
  const phases = journeyPhases.map((phase, index) => ({
    ...phase,
    index,
    state: failed && index === currentIndex ? "failed" as const : index < currentIndex ? "done" as const : index === currentIndex ? "current" as const : "upcoming" as const,
  }));

  return { current: { ...journeyPhases[currentIndex], index: currentIndex }, phases, failedMessage };
}

function RunJourney({ journey }: { journey: JourneyState }) {
  const isFailed = Boolean(journey.failedMessage);
  const isComplete = !isFailed && journey.current.index === journey.phases.length - 1 && journey.phases.every((phase) => phase.state !== "failed");
  const title = isFailed ? "Run failed" : journey.current.label;
  const detail = isFailed ? journey.failedMessage : journey.current.detail;
  return (
    <section className="mb-5 rounded-2xl border border-border bg-card/65 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"><Activity className="size-3.5 text-primary" /> Production journey</div>
          <h2 className={`mt-3 text-2xl font-semibold tracking-[-0.04em] ${isFailed ? "text-red-200" : ""}`}>{title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{detail}</p>
        </div>
        <span className={`flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] ${isFailed ? "border-red-400/30 bg-red-400/5 text-red-200" : isComplete ? "border-primary/30 bg-primary/5 text-primary" : "border-border bg-background/30 text-muted-foreground"}`}><span className={`${isFailed ? "bg-red-300" : isComplete ? "bg-primary" : "pulse-dot bg-primary"} size-1.5 rounded-full`} /> {isFailed ? "Run failed" : isComplete ? "Run complete" : "Live orchestration"}</span>
      </div>
      <div className="mt-7 grid gap-2 md:grid-cols-7">
        {journey.phases.map((phase) => (
          <div key={phase.label} className="min-w-0">
            <div className={`h-1 rounded-full ${phase.state === "done" ? "bg-primary" : phase.state === "current" ? "bg-primary/50" : phase.state === "failed" ? "bg-red-400" : "bg-muted"}`} />
            <div className={`mt-3 font-mono text-[9px] uppercase tracking-[0.11em] ${phase.state === "current" ? "text-primary" : phase.state === "failed" ? "text-red-300" : "text-muted-foreground"}`}>{phase.state === "current" ? "Now / " : ""}{phase.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ArtifactPreview({ artifact }: { artifact: RunData["versions"][number]["artifacts"][number] }) {
  return <div><div className="relative overflow-hidden rounded-xl border border-primary/20 bg-black/30">{artifact.type === "video" ? <video src={artifact.url} controls className="aspect-video w-full object-cover" /> : artifact.type === "audio" ? <div className="flex aspect-video items-center justify-center p-8"><audio src={artifact.url} controls className="w-full" /></div> : <div className="relative aspect-video"><Image src={artifact.url} alt={artifact.purpose} fill unoptimized sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" /></div>}</div><div className="mt-4 flex items-center justify-between gap-4"><p className="text-sm text-muted-foreground">{artifact.purpose}</p><span className="shrink-0 font-mono text-[10px] uppercase text-primary">REAL / LIVEPEER</span></div></div>;
}

function EmptyArtifact({ active, activity }: { active: boolean; activity: string }) { return <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-border bg-background/20 px-8"><div className="max-w-sm text-center">{active ? <LoaderCircle className="mx-auto size-7 animate-spin text-primary" /> : <CircleDashed className="mx-auto size-6 text-muted-foreground" />}<p className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">{active ? "Livepeer is working" : "No artifact returned"}</p><p className="mt-3 text-sm leading-6 text-muted-foreground">{activity}</p></div></div>; }

function EvaluationPanel({ evaluation, versions }: { evaluation: NonNullable<RunData["versions"][number]["evaluation"]>; versions: RunData["versions"] }) {
  return <section className="mt-5 rounded-2xl border border-border bg-card/50 p-5 backdrop-blur-xl md:p-7"><div className="flex flex-wrap items-end justify-between gap-6"><div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"><DatabaseZap className="size-3.5 text-primary" /> Critic review</div><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{evaluation.decision === "pass" ? "Ready to ship." : "Needs a targeted improvement."}</h2></div><div className="text-right"><div className="font-mono text-4xl text-primary">{evaluation.overall.toFixed(1)}</div><div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">overall score</div></div></div><div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{evaluation.dimensions.map((dimension) => <div key={dimension.name} className="border-t border-border pt-3"><div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.12em]"><span>{dimension.name}</span><span className={dimension.score < 5 ? "text-amber-300" : "text-primary"}>{dimension.score.toFixed(1)}</span></div><div className="mt-3 h-1 bg-muted"><div className={`h-full ${dimension.score < 5 ? "bg-amber-300" : "bg-primary"}`} style={{ width: `${dimension.score * 10}%` }} /></div></div>)}</div><div className="mt-8 flex items-center gap-3 text-sm text-muted-foreground"><Sparkles className="size-4 text-primary" />{versions.length > 1 ? `V${versions[versions.length - 1].versionNumber} preserves successful work and corrects failed dimensions.` : "The Director will diagnose the lowest-scoring dimensions before deciding whether to retry."}</div></section>;
}

function RunMetric({ label, value }: { label: string; value: string }) { return <div className="border-t border-border pt-3"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-semibold tracking-[-0.04em]">{value}</p></div>; }
function LoadingState() { return <main className="min-h-[100dvh] animate-pulse bg-[#09090b] px-5 py-6 md:px-10"><div className="mx-auto max-w-[1400px]"><div className="h-12 rounded-full bg-muted" /><div className="mt-20 h-16 max-w-xl bg-muted" /><div className="mt-12 grid gap-4 lg:grid-cols-2"><div className="h-[500px] rounded-2xl bg-muted" /><div className="h-[500px] rounded-2xl bg-muted" /></div></div></main>; }
function MessageState({ title, detail }: { title: string; detail: string }) { return <main className="flex min-h-[100dvh] items-center justify-center bg-[#09090b] px-5"><div className="max-w-md text-center"><CircleAlert className="mx-auto size-8 text-red-300" /><h1 className="mt-5 text-2xl font-semibold">{title}</h1><p className="mt-3 text-muted-foreground">{detail}</p><Link href="/run/new" className="mt-8 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Start another run</Link></div></main>; }
