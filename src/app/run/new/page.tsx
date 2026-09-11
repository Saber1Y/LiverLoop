import Link from "next/link";
import { ArrowLeft, CircleDot } from "lucide-react";
import { BriefForm } from "@/components/run/brief-form";

export default function NewRunPage() {
  return (
    <main className="min-h-[100dvh] px-5 py-6 md:px-10">
      <div className="mx-auto max-w-[1160px]">
        <header className="flex items-center justify-between border-b border-border pb-5">
          <Link href="/" className="flex items-center gap-3 font-mono text-sm tracking-[0.16em]"><span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><CircleDot className="size-4" /></span>LIVERLOOP</Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">New production / 01</span>
        </header>
        <div className="grid gap-16 py-16 md:grid-cols-[0.72fr_1.28fr] md:py-24">
          <div>
            <Link href="/" className="mb-12 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-4" /> Back home</Link>
            <h1 className="text-5xl font-semibold leading-[0.98] tracking-[-0.06em] md:text-6xl">Give the Director a brief.</h1>
            <p className="mt-6 max-w-sm text-base leading-7 text-muted-foreground">You provide the intended outcome. Liverloop selects real media capabilities, evaluates the result, and keeps the useful lesson.</p>
            <div className="mt-14 border-l border-primary/40 pl-5"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">The only input that matters</p><p className="mt-3 text-sm leading-6 text-muted-foreground">What should exist when this run is finished?</p></div>
          </div>
          <div className="rounded-2xl border border-border bg-card/45 p-5 sm:p-8"><BriefForm /></div>
        </div>
      </div>
    </main>
  );
}
