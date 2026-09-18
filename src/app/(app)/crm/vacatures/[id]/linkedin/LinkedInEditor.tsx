"use client";

import { useMemo, useState } from "react";
import { Download, Plus, Trash2, Loader2 } from "lucide-react";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cardToParams, type LinkedInCardData } from "@/lib/linkedin-card";

export function LinkedInEditor({
  dealId,
  initial,
  ogBase,
}: {
  dealId: string;
  initial: LinkedInCardData;
  ogBase: string;
}) {
  const [data, setData] = useState<LinkedInCardData>({
    ...initial,
    points: initial.points.length ? initial.points : [""],
  });
  const [downloading, setDownloading] = useState(false);

  const set = <K extends keyof LinkedInCardData>(key: K, val: LinkedInCardData[K]) =>
    setData((d) => ({ ...d, [key]: val }));

  const setPoint = (i: number, val: string) =>
    setData((d) => ({ ...d, points: d.points.map((p, j) => (j === i ? val : p)) }));
  const addPoint = () => setData((d) => ({ ...d, points: [...d.points, ""] }));
  const removePoint = (i: number) =>
    setData((d) => ({ ...d, points: d.points.filter((_, j) => j !== i) }));

  // Live preview-URL. Lege punten worden niet meegestuurd.
  const previewUrl = useMemo(() => {
    const clean: LinkedInCardData = {
      ...data,
      points: data.points.map((p) => p.trim()).filter(Boolean).slice(0, 4),
    };
    return `${ogBase}?${cardToParams(clean).toString()}`;
  }, [data, ogBase]);

  async function download() {
    setDownloading(true);
    try {
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const slug = (data.title || "vacature")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
      a.href = url;
      a.download = `q4s-linkedin-${slug || dealId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const canAddPoint = data.points.length < 4;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_440px]">
      {/* Formulier */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Vakgebied">
            <Input value={data.discipline} onChange={(e) => set("discipline", e.target.value)} />
          </Field>
          <Field label="Badge (rechtsboven)">
            <Input value={data.badge} onChange={(e) => set("badge", e.target.value)} placeholder="NIEUWE OPDRACHT" />
          </Field>
        </div>

        <Field label="Functietitel">
          <Input value={data.title} onChange={(e) => set("title", e.target.value)} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Locatie">
            <Input value={data.location} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field label="Uren / dienstverband">
            <Input value={data.hours} onChange={(e) => set("hours", e.target.value)} />
          </Field>
          <Field label="Duur / start">
            <Input value={data.duration} onChange={(e) => set("duration", e.target.value)} />
          </Field>
        </div>

        <Field label="Kort berichtje (wat houdt het werk in?)" hint="1–2 zinnen. Verschijnt boven de punten.">
          <Textarea
            rows={3}
            value={data.intro}
            onChange={(e) => set("intro", e.target.value)}
            placeholder="Jij stuurt van engineering tot oplevering complexe projecten aan…"
          />
        </Field>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink-600">Punten (3 of 4)</span>
            {canAddPoint && (
              <button
                type="button"
                onClick={addPoint}
                className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Punt toevoegen
              </button>
            )}
          </div>
          <div className="space-y-2">
            {data.points.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <Input value={p} onChange={(e) => setPoint(i, e.target.value)} placeholder={`Punt ${i + 1}`} />
                {data.points.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePoint(i)}
                    className="shrink-0 rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-red-600"
                    aria-label="Punt verwijderen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <Field label="Oproep-regel (onderaan)">
          <Input value={data.cta} onChange={(e) => set("cta", e.target.value)} />
        </Field>

        <div className="flex gap-2 pt-1">
          <Button onClick={download} disabled={downloading} className="flex-1 justify-center">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? "Bezig…" : "Download PNG (1080×1350)"}
          </Button>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "justify-center")}
          >
            Openen
          </a>
        </div>
      </div>

      {/* Live voorbeeld — compact, vast rechts */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="mx-auto w-full max-w-[440px] overflow-hidden rounded-xl border border-ink-200 bg-ink-100 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="LinkedIn-voorbeeld"
            className="block aspect-[4/5] w-full"
          />
        </div>
        <p className="mt-2 text-center text-xs text-ink-400">
          Voorbeeld · 1080×1350
        </p>
      </div>
    </div>
  );
}
