"use client";

import { useEffect, useState } from "react";
import { FileSearch, ScanLine, ListChecks, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Wat je ziet terwijl de AI het CV uitleest.
 *
 * Een spinner zegt alleen "wacht"; dit vertelt wát er gebeurt. Het uitlezen
 * duurt vaak tien tot twintig seconden, en zonder tussenstand denk je al snel
 * dat er iets hangt. De stappen lopen op de klok mee — ze zijn een indicatie
 * van het verloop, niet van de echte voortgang van het model, want die geeft de
 * API niet terug. De laatste stap blijft daarom staan tot het antwoord er is.
 */

const STAPPEN = [
  { icon: FileSearch, tekst: "Bestand openen en tekst eruit halen", ms: 2500 },
  { icon: ScanLine, tekst: "Naam, functie en contactgegevens zoeken", ms: 4000 },
  { icon: ListChecks, tekst: "Werkervaring, opleiding en certificaten ordenen", ms: 6000 },
  { icon: Sparkles, tekst: "Q4S-CV opmaken", ms: Infinity },
];

export function CvBuildingAnimation({ className }: { className?: string }) {
  const [stap, setStap] = useState(0);

  useEffect(() => {
    if (stap >= STAPPEN.length - 1) return;
    const t = setTimeout(() => setStap((s) => s + 1), STAPPEN[stap].ms);
    return () => clearTimeout(t);
  }, [stap]);

  return (
    <div
      className={cn(
        "rounded-sm border border-ink-100 bg-white p-6",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-5">
        {/* Een vel dat zich vult: de scanlijn loopt eroverheen terwijl de
            regels een voor een verschijnen. */}
        <div className="cv-anim-vel shrink-0">
          <span className="cv-anim-band" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="cv-anim-regel" style={{ animationDelay: `${i * 0.22}s` }} />
          ))}
          <span className="cv-anim-scan" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink-900">Bezig met het Q4S-CV…</p>
          <ol className="mt-3 space-y-2">
            {STAPPEN.map((s, i) => {
              const Icon = s.icon;
              const klaar = i < stap;
              const bezig = i === stap;
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-2.5 text-sm transition-colors",
                    klaar && "text-ink-400",
                    bezig && "text-ink-900",
                    !klaar && !bezig && "text-ink-300",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-sm",
                      klaar && "bg-emerald-50 text-emerald-600",
                      bezig && "bg-brand-50 text-brand-600",
                      !klaar && !bezig && "bg-ink-50 text-ink-300",
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", bezig && "animate-pulse")} />
                  </span>
                  <span className={cn(bezig && "font-medium")}>{s.tekst}</span>
                  {klaar && <span className="text-emerald-600">✓</span>}
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-ink-400">
            Dit duurt meestal tien tot twintig seconden. Je hoeft niets te doen.
          </p>
        </div>
      </div>

      <style>{`
        .cv-anim-vel {
          position: relative;
          width: 74px;
          height: 104px;
          border-radius: 3px;
          border: 1px solid #e7e7e5;
          background: #fff;
          overflow: hidden;
          padding: 8px 8px 0;
          box-shadow: 0 6px 18px -12px rgb(0 0 0 / 0.4);
        }
        .cv-anim-band {
          display: block;
          height: 16px;
          margin: -8px -8px 8px;
          background: var(--color-brand-600, #e8430a);
        }
        .cv-anim-regel {
          display: block;
          height: 5px;
          margin-bottom: 6px;
          border-radius: 2px;
          background: #e7e7e5;
          transform-origin: left center;
          animation: cvRegel 2.4s ease-in-out infinite;
        }
        .cv-anim-regel:nth-child(3) { width: 85%; }
        .cv-anim-regel:nth-child(4) { width: 60%; }
        .cv-anim-regel:nth-child(5) { width: 92%; }
        .cv-anim-regel:nth-child(6) { width: 70%; }
        .cv-anim-regel:nth-child(7) { width: 80%; }
        @keyframes cvRegel {
          0%, 100% { transform: scaleX(0.25); opacity: 0.35; }
          50%      { transform: scaleX(1);    opacity: 1; }
        }
        /* De scanlijn die over het vel loopt — het "lezen" zelf. */
        .cv-anim-scan {
          position: absolute;
          left: 0; right: 0;
          height: 26px;
          top: -26px;
          background: linear-gradient(
            to bottom,
            transparent,
            color-mix(in srgb, var(--color-brand-600, #e8430a) 22%, transparent),
            transparent
          );
          animation: cvScan 2.2s linear infinite;
        }
        @keyframes cvScan {
          0%   { top: -26px; }
          100% { top: 104px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cv-anim-regel, .cv-anim-scan { animation: none; }
          .cv-anim-regel { transform: scaleX(1); opacity: 1; }
          .cv-anim-scan { display: none; }
        }
      `}</style>
    </div>
  );
}
