"use client";

import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Editor voor de carrousel-COVER (eerste slide): groot aantal + kop. */
export function CoverEditor({
  ogBase,
  defaultCount,
}: {
  ogBase: string;
  defaultCount: number;
}) {
  const [count, setCount] = useState(String(defaultCount || 3));
  const [kicker, setKicker] = useState("Nieuwe opdrachten in de wereld van staalbouw");
  const [line1, setLine1] = useState("nieuwe");
  const [line2, setLine2] = useState("opdrachten");
  const [pages, setPages] = useState("");
  const [downloading, setDownloading] = useState(false);

  const previewUrl = useMemo(() => {
    const p = new URLSearchParams({ type: "cover", count, kicker, line1, line2 });
    if (pages.trim()) p.set("pages", pages.trim());
    return `${ogBase}?${p.toString()}`;
  }, [ogBase, count, kicker, line1, line2, pages]);

  async function download() {
    setDownloading(true);
    try {
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `q4s-linkedin-cover.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Aantal" hint="Getal in de cirkel.">
            <Input value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
          <Field label="Pagina's (optioneel)" hint="Bijv. 4 pagina's.">
            <Input value={pages} onChange={(e) => setPages(e.target.value)} placeholder="4 pagina's" />
          </Field>
        </div>
        <Field label="Kicker (balk bovenaan)">
          <Input value={kicker} onChange={(e) => setKicker(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Kop regel 1">
            <Input value={line1} onChange={(e) => setLine1(e.target.value)} />
          </Field>
          <Field label="Kop regel 2">
            <Input value={line2} onChange={(e) => setLine2(e.target.value)} />
          </Field>
        </div>

        <div className="flex gap-2 pt-1">
          <Button onClick={download} disabled={downloading} className="flex-1 justify-center">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? "Bezig…" : "Download PNG (1080×1080)"}
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

      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-ink-100 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Cover-voorbeeld" className="block aspect-square w-full" />
        </div>
        <p className="mt-2 text-center text-xs text-ink-400">
          Cover-slide — vaste Q4S-huisstijl, LinkedIn-vierkant 1080×1080
        </p>
      </div>
    </div>
  );
}
