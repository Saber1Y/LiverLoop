import Link from "next/link";
import { ArrowUpRight, BrainCircuit, DatabaseZap, Play, ScanSearch, Sparkles } from "lucide-react";

const loop = [
  { index: "01", label: "CREATE", detail: "Director maps the brief to real media capabilities." },
  { index: "02", label: "EVALUATE", detail: "Critic scores the outcome against the intended message." },
  { index: "03", label: "IMPROVE", detail: "Only the failed part is sent back through compute." },
  { index: "04", label: "REMEMBER", detail: "The useful lesson becomes verifiable knowledge." },
];

export default function Home() {
  return (
    <main className="min-h-[100dvh] overflow-hidden">
      <nav className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-5 py-5 md:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="Liverloop home">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="size-2.5 rounded-full bg-current" />
          </span>
          <span className="font-mono text-sm font-semibold tracking-[0.18em]">LIVERLOOP</span>
        </Link>
        <div className="flex items-center gap-5 text-sm text-muted-foreground">
          <Link href="#loop" className="hidden transition-colors hover:text-foreground sm:block">The loop</Link>
          <Link href="#proof" className="hidden transition-colors hover:text-foreground sm:block">Why it matters</Link>
          <Link href="/run/new" className="group flex items-center gap-2 text-foreground">
            Start a run <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </nav>

      <section className="hairline-grid relative mx-auto grid min-h-[calc(100dvh-72px)] w-full max-w-[1400px] items-center gap-16 px-5 pb-20 pt-10 md:grid-cols-[1.02fr_0.98fr] md:px-10 md:pt-4">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-7 font-mono text-[11px] uppercase tracking-[0.22em] text-primary">Autonomous media production / 01</p>
          <h1 className="max-w-[700px] text-5xl font-semibold leading-[0.97] tracking-[-0.065em] text-foreground sm:text-6xl md:text-7xl">
            Generate.<br />
            Evaluate.<br />
            <span className="text-primary">Improve.</span><br />
            Remember.
          </h1>
          <p className="mt-8 max-w-lg text-lg leading-8 text-muted-foreground">
            Liverloop is an agentic media system that creates, critiques, selectively improves, and preserves what worked.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/run/new" className="group inline-flex h-12 items-center gap-3 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 active:translate-y-0">
              Start a run <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
            <a href="#loop" className="inline-flex h-12 items-center gap-2 rounded-lg border border-border px-5 text-sm text-foreground transition-colors hover:bg-white/[0.04]">
              <Play className="size-3.5 fill-current" /> See the loop
            </a>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[560px] md:ml-auto">
          <div className="absolute -inset-10 rounded-full bg-primary/[0.06] blur-3xl" />
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card/80 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <span className="pulse-dot size-1.5 rounded-full bg-primary" /> Live production
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">RUN / 014</span>
            </div>
            <div className="grid gap-0 sm:grid-cols-[1fr_1.15fr]">
              <div className="border-b border-border p-5 sm:border-b-0 sm:border-r">
                <div className="mb-8 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Director activity</div>
                <div className="space-y-5">
                  <ActivityRow icon={<BrainCircuit className="size-4" />} label="understood brief" state="complete" />
                  <ActivityRow icon={<Sparkles className="size-4" />} label="selected video generation" state="complete" />
                  <ActivityRow icon={<ScanSearch className="size-4" />} label="critic reviewing output" state="active" />
                  <ActivityRow icon={<DatabaseZap className="size-4" />} label="knowledge pending" state="pending" />
                </div>
              </div>
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <span>Current artifact</span><span className="text-primary">V1</span>
                </div>
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-primary/20 bg-[#14201f]">
                  <div className="absolute inset-0 opacity-70" style={{ background: "radial-gradient(circle at 65% 35%, rgba(200,245,106,.28), transparent 25%), linear-gradient(135deg, #182a28, #0c1315 62%)" }} />
                  <div className="absolute inset-x-5 bottom-5">
                    <div className="mb-2 h-px w-2/3 bg-primary/70" />
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/90">media / evaluation / memory</div>
                  </div>
                  <div className="absolute right-5 top-5 rounded border border-primary/25 px-2 py-1 font-mono text-[9px] text-primary">LIVEPEER</div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[10px]">
                  <Metric label="Visual" value="8.7" />
                  <Metric label="Message" value="5.9" warning />
                  <Metric label="Cost" value="$0.21" />
                </div>
              </div>
            </div>
          </div>
          <p className="relative mt-4 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">real work / visible decisions / durable memory</p>
        </div>
      </section>

      <section id="loop" className="mx-auto w-full max-w-[1400px] border-t border-border px-5 py-24 md:px-10 md:py-32">
        <div className="max-w-xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">The operating loop</p>
          <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] md:text-5xl">Generation is only the first decision.</h2>
        </div>
        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
          {loop.map((item, index) => (
            <div key={item.index} className={`min-h-64 bg-background p-6 ${index === 2 ? "bg-primary text-primary-foreground" : ""}`}>
              <div className={`font-mono text-[11px] ${index === 2 ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{item.index}</div>
              <div className="mt-20 text-2xl font-semibold tracking-[-0.04em]">{item.label}</div>
              <p className={`mt-3 max-w-[18ch] text-sm leading-6 ${index === 2 ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="proof" className="mx-auto grid w-full max-w-[1400px] gap-12 border-t border-border px-5 py-24 md:grid-cols-[0.7fr_1.3fr] md:px-10 md:py-32">
        <div>
          <h2 className="text-4xl font-semibold tracking-[-0.05em] md:text-5xl">A production team, not a prompt box.</h2>
          <p className="mt-6 max-w-md leading-7 text-muted-foreground">Livepeer performs the media work. The Director chooses the path. The Critic explains the miss. OriginTrail keeps the lesson.</p>
        </div>
        <div className="grid gap-10 border-l border-border pl-6 sm:grid-cols-3 md:pl-10">
          <Proof icon={<Sparkles />} title="Livepeer" detail="Real multimodal compute, discovered from the live capability network." />
          <Proof icon={<ScanSearch />} title="Critic" detail="Evidence and diagnosis instead of an unexamined 'looks good'." />
          <Proof icon={<DatabaseZap />} title="OriginTrail" detail="A published knowledge asset that changes the next plan." />
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-[1400px] items-center justify-between border-t border-border px-5 py-8 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground md:px-10">
        <span>LIVERLOOP / 2026</span><span>Generate. Evaluate. Improve. Remember.</span>
      </footer>
    </main>
  );
}

function ActivityRow({ icon, label, state }: { icon: React.ReactNode; label: string; state: "complete" | "active" | "pending" }) {
  return <div className="flex items-center gap-3 text-sm"><span className={state === "complete" ? "text-primary" : state === "active" ? "text-foreground" : "text-muted-foreground/40"}>{icon}</span><span className={state === "pending" ? "text-muted-foreground/50" : "text-foreground/80"}>{label}</span><span className="ml-auto font-mono text-[9px] uppercase text-muted-foreground">{state}</span></div>;
}

function Metric({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return <div className="rounded-md border border-border bg-background/50 p-2"><div className="text-muted-foreground">{label}</div><div className={warning ? "mt-1 text-amber-300" : "mt-1 text-foreground"}>{value}</div></div>;
}

function Proof({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div><div className="mb-5 text-primary">{icon}</div><h3 className="font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p></div>;
}
