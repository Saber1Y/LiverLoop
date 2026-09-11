"use client";

import { useEffect, useState } from "react";
import { Activity, ArrowLeft, AudioLines, Check, CircleAlert, CircleDashed, DatabaseZap, LoaderCircle, Sparkles } from "lucide-react";
import Link from "next/link";

type RunData = {
  run: { id: string; brief: { objective: string; audience?: string; format?: string; duration?: number; style?: string; cta?: string }; status: string; currentVersion: number; totalCost: number };
  events: { id: string; type: string; data: Record<string, unknown>; createdAt: string; versionNumber: number | null }[];
  versions: { id: string; versionNumber: number; selected: boolean; evaluation: { overall: number; decision: string; dimensions: { name: string; score: number }[] } | null; artifacts: { id: string; type: string; url: string; capability: string; purpose: string; metadata: Record<string, unknown> }[] }[];
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

  const latest = data.versions[data.versions.length - 1];
  const latestArtifact = latest?.artifacts[latest.artifacts.length - 1];
  const isActive = ["planning", "generating", "evaluating", "improving"].includes(data.run.status);

  return (
    <main className="min-h-[100dvh] px-5 py-6 md:px-10">
      <div className="mx-auto max-w-[1400px]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <div className="flex items-center gap-5"><Link href="/" className="font-mono text-sm tracking-[0.16em]">LIVERLOOP</Link><span className="text-muted-foreground/40">/</span><span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Run {data.run.id}</span></div>
          <Link href="/run/new" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> New run</Link>
        </header>

        <section className="grid gap-12 border-b border-border py-12 lg:grid-cols-[0.8fr_1.2fr] lg:py-16">
          <div><div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-primary"><span className={`size-1.5 rounded-full ${isActive ? "pulse-dot bg-primary" : data.run.status === "failed" ? "bg-red-400" : "bg-primary"}`} /> {data.run.status}</div><h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight tracking-[-0.05em] md:text-6xl">{data.run.brief.objective}</h1><div className="mt-8 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{data.run.brief.format ? <span className="rounded border border-border px-2 py-1">{data.run.brief.format}</span> : null}{data.run.brief.duration ? <span className="rounded border border-border px-2 py-1">{data.run.brief.duration}s</span> : null}{data.run.brief.audience ? <span className="rounded border border-border px-2 py-1">{data.run.brief.audience}</span> : null}</div></div>
          <div className="grid gap-3 sm:grid-cols-3 lg:items-end"><RunMetric label="Version" value={latest ? `V${latest.versionNumber}` : "--"} /><RunMetric label="Livepeer cost" value={`$${data.run.totalCost.toFixed(4)}`} /><RunMetric label="Ledger events" value={String(data.events.length)} /></div>
        </section>

        <section className="grid gap-px border-x border-b border-border bg-border lg:grid-cols-[0.75fr_1.25fr]">
          <div className="bg-background p-5 md:p-8"><div className="mb-8 flex items-center justify-between"><h2 className="font-mono text-[11px] uppercase tracking-[0.18em]">Execution ledger</h2><Activity className="size-4 text-primary" /></div><div className="space-y-1">{data.events.slice().reverse().map((event) => <EventRow key={event.id} event={event} active={isActive && event === data.events[0]} />)}</div>{data.events.length === 0 ? <p className="text-sm text-muted-foreground">Waiting for the Director.</p> : null}</div>
          <div className="min-h-[500px] bg-card/45 p-5 md:p-8"><div className="mb-8 flex items-center justify-between"><h2 className="font-mono text-[11px] uppercase tracking-[0.18em]">Media output</h2><span className="font-mono text-[10px] text-primary">{latest ? `V${latest.versionNumber}` : "WAITING"}</span></div>{latestArtifact ? <ArtifactPreview artifact={latestArtifact} /> : <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-border"><div className="text-center"><LoaderCircle className="mx-auto size-6 animate-spin text-primary" /><p className="mt-4 text-sm text-muted-foreground">The first artifact will appear here.</p></div></div>}</div>
        </section>

        {latest?.evaluation ? <EvaluationPanel evaluation={latest.evaluation} versions={data.versions} /> : null}
      </div>
    </main>
  );
}

function EventRow({ event, active }: { event: RunData["events"][number]; active: boolean }) {
  const failed = event.type === "RUN_FAILED";
  return <div className="flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-white/[0.03]"><span className={`mt-0.5 ${failed ? "text-red-300" : active ? "text-primary" : "text-muted-foreground"}`}>{failed ? <CircleAlert className="size-4" /> : event.type.includes("COMPLETED") || event.type.includes("CREATED") ? <Check className="size-4" /> : active ? <LoaderCircle className="size-4 animate-spin" /> : <CircleDashed className="size-4" />}</span><div className="min-w-0 flex-1"><p className="font-mono text-[10px] tracking-[0.1em] text-foreground/80">{event.type.replaceAll("_", " ")}</p><p className="mt-1 truncate text-xs text-muted-foreground">{event.data.capability ? String(event.data.capability) : event.data.message ? String(event.data.message) : "System recorded this decision."}</p></div><time className="font-mono text-[9px] text-muted-foreground/60">{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>;
}

function ArtifactPreview({ artifact }: { artifact: RunData["versions"][number]["artifacts"][number] }) {
  return <div><div className="overflow-hidden rounded-xl border border-border bg-black/20">{artifact.type === "video" ? <video src={artifact.url} controls className="aspect-video w-full object-cover" /> : artifact.type === "audio" ? <div className="flex aspect-video items-center justify-center p-8"><AudioPlayer src={artifact.url} /></div> : <img src={artifact.url} alt={artifact.purpose} className="aspect-video w-full object-cover" />}</div><div className="mt-4 flex items-center justify-between gap-4"><p className="text-sm text-muted-foreground">{artifact.purpose}</p><span className="shrink-0 font-mono text-[10px] uppercase text-primary">REAL / LIVEPEER</span></div></div>;
}

function AudioPlayer({ src }: { src: string }) { return <audio src={src} controls className="w-full" />; }

function EvaluationPanel({ evaluation, versions }: { evaluation: NonNullable<RunData["versions"][number]["evaluation"]>; versions: RunData["versions"] }) {
  return <section className="border-b border-border py-12 md:py-16"><div className="flex flex-wrap items-end justify-between gap-6"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Critic review</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{evaluation.decision === "pass" ? "Ready to ship." : "Needs a targeted improvement."}</h2></div><div className="text-right"><div className="font-mono text-4xl text-primary">{evaluation.overall.toFixed(1)}</div><div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">overall score</div></div></div><div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{evaluation.dimensions.map((dimension) => <div key={dimension.name} className="border-t border-border pt-3"><div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.12em]"><span>{dimension.name}</span><span className={dimension.score < 5 ? "text-amber-300" : "text-primary"}>{dimension.score.toFixed(1)}</span></div><div className="mt-3 h-1 bg-muted"><div className={`h-full ${dimension.score < 5 ? "bg-amber-300" : "bg-primary"}`} style={{ width: `${dimension.score * 10}%` }} /></div></div>)}</div><div className="mt-10 flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><Sparkles className="size-4 text-primary" />{versions.length > 1 ? `V${versions[versions.length - 1].versionNumber} exists because the Director preserved successful work and corrected the failed dimensions.` : "The Director will diagnose the lowest-scoring dimensions before deciding whether to retry."}<DatabaseZap className="ml-2 size-4 text-primary" /></div></section>;
}

function RunMetric({ label, value }: { label: string; value: string }) { return <div className="border-t border-border pt-3"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-semibold tracking-[-0.04em]">{value}</p></div>; }
function LoadingState() { return <main className="min-h-[100dvh] animate-pulse px-5 py-6 md:px-10"><div className="mx-auto max-w-[1400px]"><div className="h-6 w-32 bg-muted" /><div className="mt-20 h-16 max-w-xl bg-muted" /><div className="mt-12 grid gap-4 lg:grid-cols-2"><div className="h-[500px] bg-muted" /><div className="h-[500px] bg-muted" /></div></div></main>; }
function MessageState({ title, detail }: { title: string; detail: string }) { return <main className="flex min-h-[100dvh] items-center justify-center px-5"><div className="max-w-md text-center"><CircleAlert className="mx-auto size-8 text-red-300" /><h1 className="mt-5 text-2xl font-semibold">{title}</h1><p className="mt-3 text-muted-foreground">{detail}</p><Link href="/run/new" className="mt-8 inline-flex rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Start another run</Link></div></main>; }
