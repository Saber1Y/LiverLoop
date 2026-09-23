"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, CheckCircle2, DatabaseZap, ExternalLink, LoaderCircle, ShieldCheck, XCircle } from "lucide-react";

type Asset = { id: string; runId: string; content: { project: string; run: string; lessons: string[]; finalVersion: string }; ual: string | null; network: string | null; status: string; publishedAt: string | null };
type Verifier = {
  state?: string;
  memoryLayer?: string;
  assertionGraph?: string;
  publishedUal?: string | null;
  reservedUal?: string | null;
  status?: string | null;
  vmCurrentAssertion?: string | null;
  currentShareOperationId?: string | null;
  agentAddress?: string | null;
};
type Facts = { network: string; chainId: string; hubAddress: string; blockExplorerAddressUrl: string; blockExplorerUrl: string };
type VerifyResult =
  | { kind: "loading" }
  | { kind: "verified"; verified: Verifier; facts: Facts; ual: string }
  | { kind: "failed"; error: string; facts: Facts; ual: string };

export default function KnowledgePage() {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  useEffect(() => { fetch("/api/knowledge", { cache: "no-store" }).then((res) => res.json()).then((data: { assets: Asset[] }) => setAssets(data.assets)); }, []);
  return <main className="relative min-h-[100dvh] overflow-hidden bg-[#09090b] px-5 py-5 text-foreground md:px-10"><div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)", backgroundSize: "32px 32px" }} /><div className="relative z-10 mx-auto max-w-[1160px]"><Header /><div className="py-16 md:py-24"><div className="flex items-start justify-between gap-8"><div><div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"><span className="size-1.5 rounded-full bg-primary" /> OriginTrail memory</div><h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.065em] md:text-7xl">What Liverloop remembers.</h1><p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">Selected lessons from completed production runs, published as verifiable Knowledge Assets rather than hidden application logs.</p></div><DatabaseZap className="mt-3 hidden size-9 text-primary md:block" /></div><div className="mt-16">{assets === null ? <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"><LoaderCircle className="size-4 animate-spin text-primary" /> Loading published assets</div> : assets.length === 0 ? <EmptyKnowledge /> : <div className="grid gap-4">{assets.map((asset, index) => <motion.div key={asset.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}><AssetCard asset={asset} /></motion.div>)}</div>}</div></div></div></main>;
}

function Header() { return <header className="flex items-center justify-between rounded-full border border-border bg-card/70 px-4 py-3 shadow-xl shadow-black/10 backdrop-blur-xl md:px-5"><Link href="/" className="flex items-center gap-3 font-mono text-sm tracking-[0.16em]"><span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><span className="size-2 rounded-full bg-current" /></span>LIVERLOOP</Link><div className="flex items-center gap-4"><Link href="/provenance" className="text-xs text-muted-foreground hover:text-foreground">Provenance</Link><Link href="/run/new" className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">New run <ArrowUpRight className="size-3" /></Link></div></header>; }

function EmptyKnowledge() { return <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center"><DatabaseZap className="mx-auto size-7 text-muted-foreground" /><p className="mt-5 text-sm text-muted-foreground">No published Knowledge Assets yet.</p><p className="mt-2 text-xs text-muted-foreground/70">Complete a real run with a funded OriginTrail wallet to create one.</p></div>; }

function AssetCard({ asset }: { asset: Asset }) {
  return <article className="rounded-2xl border border-border bg-[#0c0c0f] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl md:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"><span className={`size-1.5 rounded-full ${asset.status === "published" ? "bg-primary" : "bg-amber-300"}`} /> {asset.status === "published" ? "Published / real" : "Publication failed"}</div><h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em]">Run {asset.content.run}</h2></div>{asset.ual ? <VerifyButton asset={asset} /> : null}</div><div className="mt-8 grid gap-8 md:grid-cols-[0.8fr_1.2fr]"><div><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Lessons retained</p><ul className="mt-4 space-y-3">{asset.content.lessons.map((lesson) => <li key={lesson} className="flex gap-3 text-sm leading-6 text-foreground/80"><span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />{lesson}</li>)}</ul></div><div className="border-l border-border pl-6 md:pl-8"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Asset evidence</p><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4 border-b border-border pb-3"><dt className="text-muted-foreground">Network</dt><dd className="font-mono text-xs">{asset.network ?? "unavailable"}</dd></div><div className="flex justify-between gap-4 border-b border-border pb-3"><dt className="text-muted-foreground">Final version</dt><dd className="font-mono text-xs">{asset.content.finalVersion}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">UAL</dt><dd className="max-w-[24ch] truncate font-mono text-xs">{asset.ual ?? "not published"}</dd></div></dl></div></div></article>;
}

function VerifyButton({ asset }: { asset: Asset }) {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const toggle = () => {
    if (result) { setResult(null); return; }
    setResult({ kind: "loading" });
    fetch(`/api/knowledge/${encodeURIComponent(asset.id)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.verification === "verified" && data.verified) setResult({ kind: "verified", verified: data.verified, facts: data.facts, ual: asset.ual ?? "" });
        else setResult({ kind: "failed", error: data.error ?? "Verification could not be completed.", facts: data.facts, ual: asset.ual ?? "" });
      })
      .catch((error: Error) => setResult({ kind: "failed", error: error.message, facts: {} as Facts, ual: asset.ual ?? "" }));
  };
  return <div className="flex flex-col items-end gap-3"><button type="button" onClick={toggle} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground">{result && result.kind !== "loading" ? <XCircle className="size-3" /> : <ShieldCheck className="size-3" />} {result && result.kind !== "loading" ? "Close" : "Verify live"} <ExternalLink className="size-3" /></button><AnimatePresence>{result ? <motion.div key="v" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="w-full overflow-hidden"><VerifyPanel result={result} /></motion.div> : null}</AnimatePresence></div>;
}

function VerifyPanel({ result }: { result: VerifyResult }) {
  if (result.kind === "loading") return <div className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card/40 p-5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"><LoaderCircle className="size-4 animate-spin text-primary" /> Querying OriginTrail node for live state</div>;
  const { ual } = result;
  return <div className="w-full rounded-2xl border border-border bg-card/40 p-5"><div className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] ${result.kind === "verified" ? "text-emerald-300" : "text-amber-300"}`}>{result.kind === "verified" ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />} {result.kind === "verified" ? `Verified on-chain - ${result.facts.chainId}` : "Verification failed"}</div>
  {result.kind === "verified" ? <dl className="mt-5 space-y-3 text-sm"><Row label="State" value={result.verified.state ?? "unknown"} mono /><Row label="Memory layer" value={result.verified.memoryLayer ?? "unknown"} mono /><Row label="Published UAL" value={result.verified.publishedUal ?? ual} mono /><Row label="Status" value={result.verified.status ?? "unknown"} mono /><Row label="Assertion" value={result.verified.vmCurrentAssertion ?? "unavailable"} mono short /><Row label="Share op" value={result.verified.currentShareOperationId ?? "unavailable"} mono short /></dl> : <p className="mt-4 text-sm leading-6 text-muted-foreground">{result.kind === "failed" ? result.error : "unavailable"}</p>}
  <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">{result.kind === "verified" && result.verified.agentAddress ? <a href={`${result.facts.blockExplorerUrl}/address/${result.verified.agentAddress}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">View publishing agent on Basescan <ExternalLink className="size-3" /></a> : <a href={result.kind === "verified" ? result.facts.blockExplorerAddressUrl : "https://sepolia.basescan.org"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">View on Basescan <ExternalLink className="size-3" /></a>}<span className="font-mono text-[10px] text-muted-foreground/70">Agent {result.kind === "verified" && result.verified.agentAddress ? result.verified.agentAddress : result.facts.hubAddress}</span></div><div className="mt-4"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">On-chain knowledge asset</p><p className="mt-2 break-all font-mono text-[10px] leading-5 text-foreground/60">{ual}</p></div></div>;
}

function Row({ label, value, mono, short }: { label: string; value: string; mono?: boolean; short?: boolean }) {
  return <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3"><dt className="shrink-0 text-muted-foreground">{label}</dt><dd className={`${mono ? "font-mono text-xs" : "text-sm"} ${short ? "max-w-[28ch] truncate" : "break-all text-right"}`}>{value}</dd></div>;
}