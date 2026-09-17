"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Clock3, DatabaseZap, LoaderCircle, Plus, Sparkles } from "lucide-react";

type Run = {
  id: string;
  brief: { objective: string; audience?: string; format?: string; duration?: number; cta?: string };
  status: string;
  currentVersion: number;
  totalCost: number;
  createdAt: string;
};

type RunWithEvents = Run & { eventCount: number };

export default function RunsPage() {
  const [runs, setRuns] = useState<RunWithEvents[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/run", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ runs: Run[] }>)
      .then(async ({ runs: nextRuns }) => {
        const enriched = await Promise.all(nextRuns.map(async (run) => {
          const response = await fetch(`/api/run/${run.id}`, { cache: "no-store" });
          const snapshot = await response.json() as { events?: unknown[] };
          return { ...run, eventCount: snapshot.events?.length ?? 0 };
        }));
        if (active) setRuns(enriched);
      })
      .catch(() => {
        if (active) setRuns([]);
      });
    return () => { active = false; };
  }, []);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#09090b] px-5 py-5 text-foreground md:px-10">
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)", backgroundSize: "32px 32px" }} />
      <div className="relative z-10 mx-auto max-w-[1160px]">
        <header className="flex items-center justify-between rounded-full border border-border bg-card/70 px-4 py-3 shadow-xl shadow-black/10 backdrop-blur-xl md:px-5">
          <Link href="/" className="flex items-center gap-3 font-mono text-sm tracking-[0.16em]"><span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><span className="size-2 rounded-full bg-current" /></span>LIVERLOOP</Link>
          <Link href="/run/new" className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background transition-transform hover:-translate-y-0.5"><Plus className="size-3.5" /> New run</Link>
        </header>

        <div className="py-16 md:py-24">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div>
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-primary"><Clock3 className="size-3.5" /> Production history</div>
              <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.065em] md:text-7xl">Every run, in context.</h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">Review the briefs, iterations, costs, failures, and durable knowledge created by Liverloop.</p>
            </div>
            <div className="rounded-2xl border border-border bg-card/60 p-5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground"><span className="text-primary">{runs?.length ?? "--"}</span> recorded runs</div>
          </div>

          <div className="mt-16">
            {runs === null ? <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"><LoaderCircle className="size-4 animate-spin text-primary" /> Loading run history</div> : runs.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-10 text-center"><Sparkles className="mx-auto size-6 text-primary" /><p className="mt-4 text-muted-foreground">No runs recorded yet.</p><Link href="/run/new" className="mt-6 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Start the first run</Link></div> : <div className="space-y-3">{runs.map((run) => <RunCard key={run.id} run={run} />)}</div>}
          </div>
        </div>
      </div>
    </main>
  );
}

function RunCard({ run }: { run: RunWithEvents }) {
  const failed = run.status === "failed";
  const completed = run.status === "completed";
  return (
    <article className="rounded-2xl border border-border bg-card/65 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl transition-colors hover:border-primary/30 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"><span className={`size-1.5 rounded-full ${failed ? "bg-red-300" : completed ? "bg-primary" : "bg-amber-300"}`} /> {run.status} <span className="text-muted-foreground/50">/</span> {run.id}</div>
          <h2 className="mt-4 text-xl font-semibold tracking-[-0.035em] md:text-2xl">{run.brief.objective}</h2>
          <div className="mt-4 flex flex-wrap gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground"><span className="rounded-full border border-border px-2.5 py-1">{run.brief.format ?? "format unknown"}</span>{run.brief.duration ? <span className="rounded-full border border-border px-2.5 py-1">{run.brief.duration}s</span> : null}<span className="rounded-full border border-border px-2.5 py-1">V{run.currentVersion}</span><span className="rounded-full border border-border px-2.5 py-1">{run.eventCount} events</span></div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-3"><span className="font-mono text-xs text-primary">${run.totalCost.toFixed(4)}</span><span className="font-mono text-[9px] text-muted-foreground">{new Date(run.createdAt).toLocaleString()}</span></div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"><DatabaseZap className="size-3.5 text-primary" /> {completed ? "Knowledge eligible" : failed ? "Needs review" : "Still running"}</span><div className="flex items-center gap-3"><Link href={`/provenance/${run.id}`} className="text-xs text-muted-foreground hover:text-foreground">Provenance</Link><Link href={`/run/${run.id}`} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary/40">Open run <ArrowRight className="size-3" /></Link></div></div>
    </article>
  );
}
