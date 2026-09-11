"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function BriefForm() {
  const router = useRouter();
  const [format, setFormat] = useState("vertical");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const body = {
      objective: String(data.get("objective") ?? "").trim(),
      audience: String(data.get("audience") ?? "").trim() || undefined,
      format,
      duration: Number(data.get("duration") ?? 20),
      style: String(data.get("style") ?? "").trim() || undefined,
      cta: String(data.get("cta") ?? "").trim() || undefined,
    };

    try {
      const created = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await created.json() as { run?: { id: string }; error?: string };
      if (!created.ok || !result.run) throw new Error(result.error ?? "Unable to create run.");

      const started = await fetch(`/api/run/${result.run.id}/execute`, { method: "POST" });
      if (!started.ok) {
        const startResult = await started.json() as { error?: string };
        throw new Error(startResult.error ?? "Unable to start production.");
      }
      router.push(`/run/${result.run.id}`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to start production.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-7">
      <div className="space-y-2">
        <label htmlFor="objective" className="text-sm font-medium text-foreground">What do you want to create?</label>
        <Textarea id="objective" name="objective" required minLength={10} rows={5} placeholder="Create a 20-second launch video for my developer-focused AI wallet." className="resize-none border-border bg-card/60 text-base leading-7 placeholder:text-muted-foreground/55" />
        <p className="text-xs text-muted-foreground">Describe the outcome. Liverloop will decide which capabilities are necessary.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Audience" name="audience" placeholder="Developers" />
        <Field label="Style" name="style" placeholder="Premium, futuristic, cinematic" />
        <div className="space-y-2">
          <label htmlFor="duration" className="text-sm font-medium text-foreground">Duration (seconds)</label>
          <Input id="duration" name="duration" type="number" min={1} max={300} defaultValue={20} className="border-border bg-card/60" />
        </div>
        <Field label="CTA" name="cta" placeholder="Build with us" />
      </div>

      <div className="space-y-3">
        <span className="text-sm font-medium text-foreground">Format</span>
        <div className="grid grid-cols-3 gap-2">
          {(["vertical", "landscape", "square"] as const).map((option) => (
            <button key={option} type="button" onClick={() => setFormat(option)} className={`rounded-lg border px-3 py-3 text-left text-sm capitalize transition-colors ${format === option ? "border-primary bg-primary/10 text-primary" : "border-border bg-card/40 text-muted-foreground hover:text-foreground"}`}>
              <span className={`mb-2 block border border-current/40 ${option === "vertical" ? "h-8 w-5" : option === "landscape" ? "h-5 w-8" : "size-6"}`} />
              {option}
            </button>
          ))}
        </div>
      </div>

      {error ? <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}

      <Button type="submit" disabled={submitting} className="h-12 w-full justify-center gap-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
        {submitting ? <><LoaderCircle className="size-4 animate-spin" /> Starting production</> : <>Start production <ArrowUpRight className="size-4" /></>}
      </Button>
    </form>
  );
}

function Field({ label, name, placeholder }: { label: string; name: string; placeholder: string }) {
  return <div className="space-y-2"><label htmlFor={name} className="text-sm font-medium text-foreground">{label}</label><Input id={name} name={name} placeholder={placeholder} className="border-border bg-card/60 placeholder:text-muted-foreground/55" /></div>;
}
