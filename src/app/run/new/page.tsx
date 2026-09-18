"use client";

import { useEffect, useState } from "react";
import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  CircleDot, 
  ScanSearch, 
  DatabaseZap, 
  BrainCircuit, 
  Command, 
  Send,
  Video,
  Play,
  CheckCircle2,
  CircleAlert,
  LoaderCircle
} from "lucide-react";

type RunSnapshot = {
  run: { id: string; status: string; totalCost: number };
  events: { id: string; type: string; data: Record<string, unknown>; createdAt: string }[];
  versions: {
    artifacts: { type: string; url: string }[];
    evaluation: { dimensions: { name: string; score: number }[] } | null;
  }[];
};

type WorkspacePhase = {
  label: string;
  detail: string;
};

type WorkspaceProgress = {
  phases: (WorkspacePhase & { state: "done" | "current" | "upcoming" })[];
  current: WorkspacePhase;
  failed: string | null;
  active: boolean;
};

const workspacePhases: WorkspacePhase[] = [
  { label: "Planning", detail: "Director is turning your brief into a production plan." },
  { label: "Memory retrieval", detail: "Checking OriginTrail for lessons from previous runs." },
  { label: "Capability selection", detail: "Selecting the next real Livepeer capability." },
  { label: "Livepeer generation", detail: "Generating the first real media artifact." },
  { label: "Evaluation", detail: "Critic is scoring the artifact against your brief." },
  { label: "Improvement", detail: "Director is deciding what to keep and regenerate." },
  { label: "Knowledge publication", detail: "Publishing the durable lesson to OriginTrail." },
];

function getWorkspaceProgress(snapshot: RunSnapshot | null, runState: string): WorkspaceProgress {
  if (!snapshot && runState === "idle") {
    return {
      phases: workspacePhases.map((phase) => ({ ...phase, state: "upcoming" as const })),
      current: { label: "Ready to start", detail: "Describe the media outcome you want, then send the brief to the Director." },
      failed: null,
      active: false,
    };
  }
  const latest = snapshot?.events[0];
  const type = latest?.type ?? "RUN_CREATED";
  const failed = snapshot?.run.status === "failed" || runState === "failed";
  const failureMessage = failed && latest?.type === "RUN_FAILED" && latest.data.message
    ? String(latest.data.message)
    : null;
  let currentIndex = 0;

  if (type === "KNOWLEDGE_RETRIEVED") currentIndex = 1;
  else if (type === "PLAN_CREATED") currentIndex = 2;
  else if (["CAPABILITY_SELECTED", "JOB_STARTED", "JOB_COMPLETED", "ARTIFACT_CREATED"].includes(type)) currentIndex = 3;
  else if (["EVALUATION_STARTED", "EVALUATION_COMPLETED"].includes(type)) currentIndex = 4;
  else if (["DIRECTOR_DECISION", "RETRY_STARTED"].includes(type)) currentIndex = 5;
  else if (["KNOWLEDGE_EXTRACTED", "KNOWLEDGE_PUBLISHED", "RUN_COMPLETED"].includes(type)) currentIndex = 6;
  if (snapshot?.run.status === "completed") currentIndex = 6;

  return {
    phases: workspacePhases.map((phase, index) => ({
      ...phase,
      state: index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
    })),
    current: workspacePhases[currentIndex],
    failed: failureMessage,
    active: !failed && runState !== "complete",
  };
}

function WorkspaceProgress({ progress }: { progress: WorkspaceProgress }) {
  return (
    <div className="w-64 rounded-xl border border-border bg-card/90 p-4 text-xs text-muted-foreground backdrop-blur-md shadow-xl">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
        {progress.failed ? <CircleAlert className="size-3 text-red-300" /> : progress.active ? <LoaderCircle className="size-3 animate-spin" /> : <span className="size-2 rounded-full bg-primary" />}
        {progress.failed ? "Run failed" : progress.current.label}
      </div>
      <p className="mt-3 leading-5">{progress.failed ?? progress.current.detail}</p>
      <div className="mt-4 space-y-2 border-t border-border pt-3">
        {progress.phases.map((phase) => (
          <div key={phase.label} className="flex items-center gap-2">
            {phase.state === "done" ? <CheckCircle2 className="size-3 text-primary" /> : phase.state === "current" ? <span className="size-2 animate-pulse rounded-full bg-primary" /> : <span className="size-2 rounded-full bg-muted" />}
            <span className={phase.state === "current" ? "text-foreground" : ""}>{phase.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  const [runState, setRunState] = useState<"idle" | "evaluating" | "fixing" | "complete" | "failed">("idle");
  const [command, setCommand] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    const applyRunStatus = (run: RunSnapshot["run"]) => {
      setSnapshot((prev) => (prev ? { ...prev, run } : prev));
      if (run.status === "completed") setRunState("complete");
      else if (run.status === "failed") setRunState("failed");
      else if (run.status === "improving") setRunState("fixing");
      else setRunState("evaluating");
    };
    const applyEvent = (event: RunSnapshot["events"][number]) => {
      setSnapshot((prev) => {
        if (!prev) return prev;
        if (prev.events.some((item) => item.id === event.id)) return prev;
        return { ...prev, events: [event, ...prev.events] };
      });
    };

    let stream: EventSource | null = null;
    let fallbackTimer: number | null = null;

    const startPollFallback = () => {
      if (fallbackTimer !== null) return;
      fallbackTimer = window.setInterval(async () => {
        const response = await fetch(`/api/run/${runId}`, { cache: "no-store" });
        if (!response.ok) return;
        const next = await response.json() as RunSnapshot;
        setSnapshot((prev) => {
          if (!prev) return next;
          const known = new Set(prev.events.map((item) => item.id));
          return { ...next, events: [...next.events.filter((item) => !known.has(item.id)), ...prev.events] };
        });
        applyRunStatus(next.run);
      }, 5000);
    };
    const stopPollFallback = () => {
      if (fallbackTimer !== null) { window.clearInterval(fallbackTimer); fallbackTimer = null; }
    };

    const connect = () => {
      stream?.close();
      stream = new EventSource(`/api/run/${runId}/stream`);
      stream.addEventListener("snapshot", (event) => {
        const next = JSON.parse((event as MessageEvent).data) as RunSnapshot;
        setSnapshot(next);
        applyRunStatus(next.run);
        stopPollFallback();
      });
      stream.addEventListener("status", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as { run: RunSnapshot["run"] };
        applyRunStatus(payload.run);
      });
      stream.addEventListener("event", (event) => {
        applyEvent(JSON.parse((event as MessageEvent).data));
      });
      stream.addEventListener("close", () => stream?.close());
      stream.onerror = () => {
        if (stream?.readyState === EventSource.CLOSED) startPollFallback();
      };
    };

    connect();
    return () => { stream?.close(); stopPollFallback(); };
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
  const fallbackVideo = latestVersion?.artifacts.slice().reverse().find((artifact) => artifact.type === "video" && artifact.url !== latestArtifact?.url);
  const progress = getWorkspaceProgress(snapshot, runState);
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
          <Link href="/runs" className="hidden items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">
            <ArrowLeft className="size-3" /> Back to runs
          </Link>
        </div>
        <div className="flex items-center gap-4">
             <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
             <span className={`size-1.5 rounded-full ${runId ? "animate-pulse bg-primary" : "bg-muted-foreground/50"}`} />
             {runId ? "Livepeer Active" : "Ready to create"}
          </span>
           <div className="rounded-full bg-card px-3 py-1 font-mono text-[10px] border border-border">{runId ? `RUN / ${runId.slice(-3)}` : "NEW RUN"}</div>
        </div>
      </header>

      {/* THE SPATIAL CANVAS */}
      <div className="relative z-10 flex h-[calc(100dvh-73px)] w-full items-center justify-center p-5 md:p-10">
        
        {/* Main Media Node - Always in the center */}
        <div className="relative w-full max-w-4xl">
          
          {/* Agent HUD - Top Left (Director) */}
          <div className="absolute left-0 top-0 z-20 flex flex-col gap-2 md:-left-8 md:-top-8 xl:-left-64 xl:-top-8">
            <div className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 font-mono text-[10px] backdrop-blur-md">
              <BrainCircuit className="size-3 text-primary" /> Production state
            </div>
            <WorkspaceProgress progress={progress} />
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
              {latestArtifact?.type === "video" ? <VideoArtifact key={latestArtifact.url} url={latestArtifact.url} fallbackUrl={fallbackVideo?.url} /> : latestArtifact?.type === "image" ? <Image src={latestArtifact.url} alt="Livepeer production artifact" fill unoptimized sizes="100vw" className="object-cover" /> : <div className="max-w-sm px-6 text-center">{progress.failed ? <CircleAlert className="mx-auto size-12 text-red-300/70" /> : progress.active ? <LoaderCircle className="mx-auto size-10 animate-spin text-primary/70" /> : <Video className="mx-auto size-10 text-white/20" />}<p className={`mt-4 font-mono text-[10px] uppercase tracking-widest ${progress.failed ? "text-red-200" : progress.active ? "text-primary" : "text-white/50"}`}>{progress.failed ? "Production paused" : progress.active ? progress.current.label : "Ready for a brief"}</p><p className="mt-3 text-sm leading-6 text-white/45">{progress.failed ? progress.failed : progress.current.detail}</p></div>}
            </div>

            {/* Overlays during fix */}
            <AnimatePresence>
              {snapshot && !progress.failed && runState !== "idle" && runState !== "complete" && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center"
                >
                  <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-primary">
                    <span className="size-2 animate-ping rounded-full bg-primary" />
                     {progress.current.label}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute bottom-4 left-4 rounded bg-black/50 px-2 py-1 font-mono text-[10px] text-white/70 backdrop-blur">
               {latestVersion ? `V${snapshot?.versions.length ?? 1}_${runState === "complete" ? "FINAL" : "PROCESSING"}` : progress.failed ? "FAILED" : progress.current.label.toUpperCase()}
            </div>
          </motion.div>

          {/* Agent HUD - Right Side (Critic & Provenance) */}
          <div className="absolute right-0 top-full z-20 mt-4 flex w-full flex-col gap-4 md:right-0 md:top-1/2 md:w-auto md:-translate-y-1/2 xl:-right-64">
            
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
                  className="w-full rounded-xl border border-primary/40 bg-primary/5 p-4 backdrop-blur-md shadow-[0_0_30px_rgba(200,245,106,0.1)] md:w-56"
                >
                  <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-primary">
                    <DatabaseZap className="size-3" /> Provenance Saved
                  </div>
                  <p className="mb-3 text-[11px] leading-tight text-muted-foreground">
                    Knowledge Asset published and available for future Director plans.
                  </p>
                   <div className="max-h-20 overflow-y-auto break-all rounded border border-primary/20 bg-background/50 p-2 text-left font-mono text-[8px] leading-4 text-muted-foreground">
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
           {error ?? (snapshot ? `${progress.failed ? "Run paused" : progress.current.label} · ${snapshot.run.id} · Livepeer cost $${snapshot.run.totalCost.toFixed(4)}` : "Director ready for a real brief")}
        </div>
      </div>

    </main>
  );
}

function VideoArtifact({ url, fallbackUrl }: { url: string; fallbackUrl?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [source, setSource] = useState(url);
  const [usingFallback, setUsingFallback] = useState(false);

  const switchToFallback = () => {
    if (fallbackUrl && source !== fallbackUrl) {
      setSource(fallbackUrl);
      setUsingFallback(true);
    }
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  return (
    <div className="group relative size-full">
      <video
        ref={videoRef}
        src={source}
        controls
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={switchToFallback}
        onLoadedMetadata={(event) => {
          if (event.currentTarget.videoWidth === 0 || event.currentTarget.videoHeight === 0) switchToFallback();
        }}
        className="size-full object-cover"
      />
      {!playing ? (
        <button
          type="button"
          onClick={togglePlayback}
          aria-label="Play final video"
          className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_35px_rgba(200,245,106,0.35)] transition-transform hover:scale-105 active:scale-95"
        >
          <Play className="ml-1 size-6 fill-current" />
        </button>
      ) : null}
      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/70 backdrop-blur">
        {usingFallback ? "Source video preview / final compose unavailable" : "Final artifact / Livepeer"}
      </div>
    </div>
  );
}
