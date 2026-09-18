"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { NavTreeHub } from "@/components/nav";

/**
 * Klikbare rechten-kiezer voor het gebruikersformulier.
 *
 * Per werkplek (hub) een schakelaar: aan = de gebruiker mag die hub zien. Klap
 * je een aangevinkte hub open, dan kun je losse pagina's aanvinken. Vink je geen
 * enkele pagina aan, dan ziet de gebruiker ÁLLE pagina's van die hub; vink je er
 * wél aan, dan ziet hij ALLEEN die. De keuzes reizen als JSON mee in twee
 * verborgen inputs; de server hervalideert ze.
 */
export function AccessPicker({
  tree,
  initialHubs,
  initialPages,
}: {
  tree: NavTreeHub[];
  initialHubs: string[];
  initialPages: string[];
}) {
  const [hubs, setHubs] = useState<Set<string>>(new Set(initialHubs));
  const [pages, setPages] = useState<Set<string>>(new Set(initialPages));
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggleHub = (href: string, itemHrefs: string[]) => {
    setHubs((prev) => {
      const next = new Set(prev);
      if (next.has(href)) {
        next.delete(href);
        // Hub uit → ook zijn losse pagina-selecties opruimen.
        setPages((pp) => {
          const np = new Set(pp);
          itemHrefs.forEach((h) => np.delete(h));
          return np;
        });
      } else {
        next.add(href);
        setOpen((o) => new Set(o).add(href));
      }
      return next;
    });
  };

  const togglePage = (href: string) => {
    setPages((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  const toggleOpen = (href: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {/* De keuzes reizen als JSON mee; de server hervalideert. */}
      <input type="hidden" name="allowedHubs" value={JSON.stringify([...hubs])} />
      <input type="hidden" name="allowedPages" value={JSON.stringify([...pages])} />

      {tree.map((hub) => {
        const itemHrefs = hub.items.map((it) => it.href);
        const hubOn = hubs.has(hub.href);
        const isOpen = open.has(hub.href);
        const chosenInHub = hub.items.filter((it) => pages.has(it.href)).length;
        return (
          <div key={hub.href} className="rounded-lg border border-ink-200 bg-white">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <label className="flex flex-1 cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={hubOn}
                  onChange={() => toggleHub(hub.href, itemHrefs)}
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
                />
                <span className="text-sm font-semibold text-ink-900">{hub.label}</span>
                {hubOn && (
                  <span className="text-xs text-ink-400">
                    {chosenInHub === 0 ? "alle pagina's" : `${chosenInHub} pagina${chosenInHub === 1 ? "" : "'s"}`}
                  </span>
                )}
              </label>
              {hubOn && hub.items.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggleOpen(hub.href)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-500 hover:bg-ink-50 hover:text-ink-800"
                >
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  Pagina&apos;s
                </button>
              )}
            </div>

            {hubOn && isOpen && hub.items.length > 0 && (
              <div className="border-t border-ink-100 px-3 py-2.5">
                <p className="mb-2 text-xs text-ink-400">
                  Niets aanvinken = alle pagina&apos;s. Vink aan om te beperken tot een selectie.
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {hub.items.map((it) => (
                    <label key={it.href} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-ink-50">
                      <input
                        type="checkbox"
                        checked={pages.has(it.href)}
                        onChange={() => togglePage(it.href)}
                        className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
                      />
                      <span className="text-sm text-ink-700">{it.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
