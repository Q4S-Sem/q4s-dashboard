"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Printer, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * "Printen / PDF" met een controle vooraf: mist het contract nog gegevens,
 * dan eerst een melding met precies wat er ontbreekt. Je kunt het dan
 * aanvullen, of bewust toch printen (bijv. een concept ter inzage).
 */
export function PrintMetControle({ href, ontbreekt }: { href: string; ontbreekt: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => (ontbreekt.length ? setOpen(true) : router.push(href))}
        className={buttonVariants({ variant: "outline" })}
      >
        <Printer className="h-4 w-4" /> Printen / PDF
      </button>

      {open &&
        createPortal(
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="ontbreekt-titel"
            className="no-print fixed inset-0 z-[150] flex items-center justify-center bg-ink-900/50 p-4"
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <div className="w-full max-w-md rounded-md border border-ink-200 bg-white p-6 shadow-2xl">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-amber-50 text-amber-600">
                  <TriangleAlert className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <h2 id="ontbreekt-titel" className="text-[17px] font-semibold text-ink-900">
                    Dit contract is nog niet compleet
                  </h2>
                  <p className="mt-1.5 text-sm text-ink-500">Vul eerst aan voordat je het verstuurt:</p>
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink-800">
                    {ontbreekt.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => router.push(href)}>
                  Toch printen
                </Button>
                <Button type="button" onClick={() => setOpen(false)} autoFocus>
                  Aanvullen
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
