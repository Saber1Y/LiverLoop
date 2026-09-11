"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  CircleDot, 
  Sparkles, 
  ScanSearch, 
  DatabaseZap, 
  BrainCircuit, 
  Command, 
  Send,
  Video,
  CheckCircle2
} from "lucide-react";

type RunSnapshot = {
  run: { id: string; status: string; totalCost: number };
  events: { type: string; data: Record<string, unknown> }[];
  versions: {
    artifacts: { type: string; url: string }[];
    evaluation: { dimensions: { name: string; score: number }[] } | null;
  }[];
};

export default function WorkspacePage() {
  const [runState, setRunState] = useState<"idle" | "evaluating" | "fixing" | "complete">("idle");
  const [command, setCommand] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    let active = true;
    const poll = async () => {
      const response = await fetch(`/api/run/${runId}`, { cache: "no-store" });
      if (!response.ok || !active) return;
      const next = await response.json() as RunSnapshot;
      setSnapshot(next);
      if (next.run.status === "completed") setRunState("complete");
      else if (next.run.status === "improving") setRunState("fixing");
      else if (next.run.status === "failed") setRunState("idle");
      else setRunState("evaluating");
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 4000);
    return () => { active = false; window.clearInterval(interval); };
  }, [runId]);

  const triggerImprovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    setError(null);
    setRunState("evaluating");
    try {
      const created = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: command.trim(), audience: "developers", format: "vertical", duration: 20, style: "premium, futuristic, cinematic", cta: "Build with us" }),
      });
      const result = await created.json() as { run?: { id: string }; error?: string };
      if (!created.ok || !result.run) throw new Error(result.error ?? "Unable to create run.");
      setRunId(result.run.id);
      const started = await fetch(`/api/run/${result.run.id}/execute`, { method: "POST" });
      if (!started.ok) throw new Error("Unable to start production.");
      setCommand("");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to start production.");
      setRunState("idle");
    }
  };

  const latestVersion = snapshot?.versions.at(-1);
  const latestArtifact = latestVersion?.artifacts.at(-1);
  const dimension = (name: string) => latestVersion?.evaluation?.dimensions.find((item) => item.name === name)?.score;
  const publishedEvent = snapshot?.events.find((event) => event.type === "KNOWLEDGE_PUBLISHED");
  const publishedUal = typeof publishedEvent?.data.ual === "string" ? publishedEvent.data.ual : null;

  return (
    <main className="relative min-h-[100dvh] w-full overflow-hidden bg-[#09090b] text-foreground">
      {/* Subtle panning grid background */}
      <div 
        className="absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }}
      />
      
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-border/40 bg-background/50 px-5 py-4 backdrop-blur-md md:px-10">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 font-mono text-sm tracking-[0.16em]">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[0_0_15px_rgba(200,245,106,0.3)]">
              <CircleDot className="size-4" />
            </span>
            LIVERLOOP
          </Link>
          <div className="hidden h-4 w-px bg-border sm:block" />
          <Link href="/" className="hidden items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">
            <ArrowLeft className="size-3" /> Back to runs
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            Livepeer Active
          </span>
          <div className="rounded-full bg-card px-3 py-1 font-mono text-[10px] border border-border">RUN / 014</div>
        </div>
      </header>

      {/* THE SPATIAL CANVAS */}
      <div className="relative z-10 flex h-[calc(100dvh-73px)] w-full items-center justify-center p-5 md:p-10">
        
        {/* Main Media Node - Always in the center */}
        <div className="relative w-full max-w-4xl">
          
          {/* Agent HUD - Top Left (Director) */}
          <div className="absolute -left-12 -top-12 z-20 flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 font-mono text-[10px] backdrop-blur-md">
              <BrainCircuit className="size-3 text-primary" /> Director Plan
            </div>
            <div className="rounded-xl border border-border bg-card/80 p-3 text-xs text-muted-foreground backdrop-blur-md shadow-xl w-48">
              <div className="flex items-center gap-2"><CheckCircle2 className="size-3 text-primary" /> Visual style matched</div>
              <div className="flex items-center gap-2 mt-2"><CheckCircle2 className="size-3 text-primary" /> Length constraints met</div>
              {runState === "fixing" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2 mt-2 pt-2 border-t border-border">
                  <Sparkles className="size-3 text-amber-400 shrink-0 mt-0.5" /> 
                  <span className="text-amber-400">Isolating audio track for FFmpeg swap...</span>
                </motion.div>
              )}
            </div>
          </div>

          {/* Central Media Artifact */}
          <motion.div 
            layout
            className={`relative aspect-[16/9] w-full overflow-hidden rounded-2xl border bg-black shadow-2xl transition-all duration-700 ${
              runState === "evaluating" || runState === "fixing" 
                ? "border-primary/50 shadow-[0_0_50px_rgba(200,245,106,0.1)]" 
                : "border-border"
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 to-neutral-950 flex items-center justify-center">
              {latestArtifact?.type === "video" ? <video src={latestArtifact.url} controls className="size-full object-cover" /> : latestArtifact?.type === "image" ? <img src={latestArtifact.url} alt="Livepeer production artifact" className="size-full object-cover" /> : <div className="text-center"><Video className="mx-auto size-12 text-white/10" /><p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-white/30">Waiting for Livepeer artifact</p></div>}
            </div>

            {/* Overlays during fix */}
            <AnimatePresence>
              {(runState === "evaluating" || runState === "fixing") && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center"
                >
                  <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-primary">
                    <span className="size-2 animate-ping rounded-full bg-primary" />
                    {runState === "evaluating" ? "Critic Evaluating..." : "Livepeer Re-rendering Audio..."}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute bottom-4 left-4 rounded bg-black/50 px-2 py-1 font-mono text-[10px] text-white/70 backdrop-blur">
              {latestVersion ? `V${snapshot?.versions.length ?? 1}_${runState === "complete" ? "FINAL" : "PROCESSING"}` : "NO ARTIFACT"}
            </div>
          </motion.div>

          {/* Agent HUD - Right Side (Critic & Provenance) */}
          <div className="absolute -right-12 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-4">
            
            {/* The Critic Block */}
            <motion.div layout className="w-56 rounded-xl border border-border bg-card/80 p-4 backdrop-blur-md shadow-xl">
              <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <ScanSearch className="size-3 text-purple-400" /> Evaluation
              </div>
              
              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between"><span>Visuals</span> <span className="text-primary">{dimension("visual")?.toFixed(1) ?? "--"}</span></div>
                <div className="flex justify-between"><span>Pacing</span> <span className="text-primary">{dimension("pacing")?.toFixed(1) ?? "--"}</span></div>
                
                {runState === "idle" && (
                  <div className="flex justify-between border-t border-border/50 pt-2 text-destructive">
                    <span>CTA</span> <span>{dimension("cta")?.toFixed(1) ?? "--"}</span>
                  </div>
                )}
                {runState === "complete" && (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex justify-between border-t border-border/50 pt-2 text-primary">
                    <span>CTA</span> <span>{dimension("cta")?.toFixed(1) ?? "--"} ✓</span>
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* The Provenance Block (Expands on complete) */}
            <AnimatePresence>
              {publishedUal && (
                <motion.div 
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="w-56 rounded-xl border border-primary/40 bg-primary/5 p-4 backdrop-blur-md shadow-[0_0_30px_rgba(200,245,106,0.1)]"
                >
                  <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-primary">
                    <DatabaseZap className="size-3" /> Provenance Saved
                  </div>
                  <p className="mb-3 text-[11px] leading-tight text-muted-foreground">
                    Knowledge Asset published and available for future Director plans.
                  </p>
                  <div className="rounded border border-primary/20 bg-background/50 p-1.5 text-center font-mono text-[8px] text-muted-foreground">
                    UAL: {publishedUal}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
      </div>

      {/* FLOATING COMMAND BAR */}
      <div className="fixed bottom-8 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 px-5">
        <form 
          onSubmit={triggerImprovement}
          className="relative flex items-center overflow-hidden rounded-full border border-border/60 bg-card/60 shadow-2xl backdrop-blur-xl transition-all focus-within:border-primary/50 focus-within:bg-card/90"
        >
          <div className="pl-5 pr-2 text-muted-foreground">
            <Command className="size-4" />
          </div>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            disabled={runState !== "idle"}
            placeholder='Describe the media outcome you want...'
            className="h-14 w-full bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
          />
          <button 
            type="submit"
            disabled={!command.trim() || runState !== "idle"}
            className="mr-2 flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          >
            <Send className="size-4" />
          </button>
        </form>
        <div className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
          {error ?? (snapshot ? `Run ${snapshot.run.id} · Livepeer cost $${snapshot.run.totalCost.toFixed(4)}` : "Director ready for a real brief")}
        </div>
      </div>

    </main>
  );
}
