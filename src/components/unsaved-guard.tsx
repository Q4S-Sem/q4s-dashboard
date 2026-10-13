"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { Save, TriangleAlert } from "lucide-react";
import { Button } from "./ui/button";

/**
 * Waarschuwt als je een pagina verlaat terwijl er nog iets openstaat.
 *
 * Zonder dit ben je alles kwijt zodra je halverwege een formulier op een
 * menu-item klikt — zonder dat iets je tegenhoudt. Nu verschijnt er eerst een
 * vraag: annuleren (blijf staan) of bevestigen (weg, wijzigingen kwijt).
 *
 * Hoe het werkt, en waarom zo:
 * - "Gewijzigd" betekent: er is een echte input/change gebeurd in een formulier
 *   op deze pagina. Dat is bewust conservatief — liever geen waarschuwing dan
 *   een valse, want een pop-up die te vaak komt leert iedereen wegklikken.
 * - Zoek- en filterformulieren (method GET) tellen niet mee; daar valt niets te
 *   verliezen. Zet `data-no-guard` op een formulier om het ook uit te sluiten.
 * - Verzenden maakt dat formulier weer schoon: na opslaan volgt de navigatie
 *   zonder vraag.
 * - Alleen kliks op links binnen de app worden onderschept. Sluit je het
 *   tabblad of ververs je, dan neemt de browser het over met zijn eigen
 *   melding (die kunnen we niet vormgeven, maar hij is er wel).
 */
/** Na een (automatische) opslag aanroepen: de pagina is niet meer "gewijzigd". */
export function meldOpgeslagen() {
  window.dispatchEvent(new Event("q4s:opgeslagen"));
}

/** Formulieren met eigen opslag luisteren hiernaar ("Opslaan en weggaan"). */
export function useOpslaanVerzoek(opslaan: () => void) {
  const ref = useRef(opslaan);
  useEffect(() => {
    ref.current = opslaan;
  });
  useEffect(() => {
    const h = () => ref.current();
    window.addEventListener("q4s:opslaan", h);
    return () => window.removeEventListener("q4s:opslaan", h);
  }, []);
}

export function UnsavedGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const dirty = useRef<Set<HTMLFormElement>>(new Set());
  const [pending, setPending] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  /** Na "Opslaan en weggaan": hier gaan we heen zodra het opslaan klaar is. */
  const naNaar = useRef<string | null>(null);

  // Opgeslagen (automatisch of via een knop zonder form-submit) = schoon.
  useEffect(() => {
    const schoon = () => (dirty.current = new Set());
    window.addEventListener("q4s:opgeslagen", schoon);
    return () => window.removeEventListener("q4s:opgeslagen", schoon);
  }, []);

  /** Opslaan en daarna naar `naar`. Eigen opslag (q4s:opslaan) of het formulier verzenden. */
  function opslaanEnWeg(naar: string) {
    setBezig(true);
    const weg = () => {
      window.removeEventListener("q4s:opgeslagen", weg);
      clearTimeout(t);
      dirty.current = new Set();
      setBezig(false);
      setPending(null);
      router.push(naar);
    };
    window.addEventListener("q4s:opgeslagen", weg);
    // ponytail: 4 s wachten op de bevestiging; daarna blijf je staan (niets kwijt).
    const t = setTimeout(() => {
      window.removeEventListener("q4s:opgeslagen", weg);
      setBezig(false);
    }, 4000);
    const eigen = [...dirty.current].some((f) =>
      f.hasAttribute("data-autosave"),
    );
    if (eigen) window.dispatchEvent(new Event("q4s:opslaan"));
    else {
      // Gewoon formulier: verzenden = opslaan (de pagina gaat daarna zelf verder).
      window.removeEventListener("q4s:opgeslagen", weg);
      clearTimeout(t);
      const f = [...dirty.current][0];
      dirty.current = new Set();
      setPending(null);
      setBezig(false);
      if (!f) return router.push(naar);
      naNaar.current = naar;
      f.requestSubmit();
      // Opslaan stuurt je soms terug naar dezelfde/een andere pagina (redirect) —
      // daarna alsnog door naar waar je heen wilde. Blijft de actie op de pagina:
      // wachten tot de opslagknop klaar is; staat er dan een fout, dan blijf je staan.
      let gezienBezig = false;
      const start = Date.now();
      const poll = setInterval(() => {
        if (!naNaar.current) return clearInterval(poll);
        const bezigNu = f.isConnected && !!f.querySelector("button[type=submit]:disabled");
        if (bezigNu) gezienBezig = true;
        const klaar = !f.isConnected || (gezienBezig && !bezigNu) || Date.now() - start > 1500 && !gezienBezig;
        if (!klaar && Date.now() - start < 15000) return;
        clearInterval(poll);
        const fout = f.isConnected && f.querySelector('[role="alert"], .text-red-600, .text-red-700');
        const doel = naNaar.current;
        naNaar.current = null;
        if (!fout && doel) router.push(doel);
      }, 200);
    }
  }

  /** Telt dit formulier mee voor de waarschuwing? */
  const guarded = useCallback(
    (form: HTMLFormElement | null): form is HTMLFormElement => {
      if (!form) return false;
      if (form.hasAttribute("data-no-guard")) return false;
      if (form.closest("[data-no-guard]")) return false;
      // Zoeken/filteren gaat via GET en verandert niets — daar valt niets kwijt.
      // Let op: lees het ATTRIBUUT. `form.method` is "get" voor élk formulier
      // zonder method-attribuut — ook React-formulieren met een server-action —
      // waardoor de waarschuwing voorheen nergens afging.
      if ((form.getAttribute("method") ?? "").toLowerCase() === "get")
        return false;
      return true;
    },
    [],
  );

  // --- Bijhouden wat er gewijzigd is -----------------------------------------
  useEffect(() => {
    const onEdit = (e: Event) => {
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      // "change" van een tekstveld vuurt pas bij het verlaten (klik op Terug) —
      // het typen zelf is al via "input" gezien. Anders wordt een net
      // opgeslagen formulier op het laatste moment weer "gewijzigd".
      if (
        e.type === "change" &&
        (el instanceof HTMLTextAreaElement ||
          (el instanceof HTMLInputElement &&
            !["checkbox", "radio", "file", "date"].includes(el.type)))
      )
        return;
      const form = el.closest("form");
      if (guarded(form)) dirty.current.add(form);
    };
    const onSubmit = (e: Event) => {
      const form = e.target;
      if (form instanceof HTMLFormElement) dirty.current.delete(form);
    };

    document.addEventListener("input", onEdit, true);
    document.addEventListener("change", onEdit, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("input", onEdit, true);
      document.removeEventListener("change", onEdit, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [guarded]);

  // Nieuwe pagina = schone lei. Kwam die nieuwe pagina van de opslag-redirect,
  // dan alsnog door naar de bestemming van "Opslaan en weggaan".
  useEffect(() => {
    if (naNaar.current && naNaar.current.split("?")[0] !== pathname) {
      const doel = naNaar.current;
      naNaar.current = null;
      router.push(doel);
    } else naNaar.current = null;
    dirty.current = new Set();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending(null);
  }, [pathname, router]);

  // --- Tabblad sluiten of verversen ------------------------------------------
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current.size === 0) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // --- Klikken op een link binnen de app -------------------------------------
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dirty.current.size === 0) return;
      // Middelklik en ctrl/cmd-klik openen een nieuw tabblad: deze pagina blijft
      // gewoon staan, dus daar hoeft niets gevraagd te worden.
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const el = e.target;
      if (!(el instanceof Element)) return;
      const link = el.closest("a");
      if (!(link instanceof HTMLAnchorElement)) return;

      const href = link.getAttribute("href");
      if (!href || !href.startsWith("/")) return; // extern, mailto:, tel:, anker
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;
      if (href.split("?")[0] === pathname) return; // zelfde pagina

      e.preventDefault();
      e.stopPropagation();
      setPending(href);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  if (!pending || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="weggaan-titel"
      className="no-print fixed inset-0 z-[150] flex items-center justify-center bg-ink-900/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) setPending(null);
      }}
    >
      <div className="w-full max-w-md rounded-md border border-ink-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-amber-50 text-amber-600">
            <TriangleAlert className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h2
              id="weggaan-titel"
              className="text-[17px] font-semibold text-ink-900"
            >
              Weet je zeker dat je weggaat?
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
              Je laatste wijzigingen zijn nog niet opgeslagen. Klik op Opslaan
              en weggaan: alles wordt eerst volledig opgeslagen.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPending(null)}
          >
            Annuleren
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const naar = pending;
              dirty.current = new Set();
              setPending(null);
              router.push(naar);
            }}
          >
            Niet opslaan
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={bezig}
            onClick={() => opslaanEnWeg(pending)}
            autoFocus
          >
            <Save className="h-4 w-4" />{" "}
            {bezig ? "Opslaan…" : "Opslaan en weggaan"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
