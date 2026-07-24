"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Globale "concept blijft bewaard": terwijl je in een formulier typt worden de
// veldwaarden per pagina in sessionStorage opgeslagen, en bij terugkomst op die
// pagina automatisch teruggezet — zodat je niets kwijtraakt als je even naar een
// andere pagina navigeert. Bij het (succesvol) verzenden van een formulier wordt
// het concept van dát formulier gewist. Werkt op ELK formulier, zonder per-form
// code, omgekeerd luisterend op document-niveau.
//
// Privacy: sessionStorage is per-tabblad en wordt gewist zodra het tabblad sluit;
// wachtwoord-, bestands- en verborgen velden worden nooit opgeslagen. Zet
// `data-no-persist` op een veld of formulier om het uit te sluiten.

const PREFIX = "q4s-draft:";
const SKIP_TYPES = new Set([
  "password",
  "file",
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
]);

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function persistable(el: EventTarget | null): el is Field {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return false;
  const f = el as Field;
  if (!f.name) return false;
  if (tag === "INPUT" && SKIP_TYPES.has((el as HTMLInputElement).type)) return false;
  if (el.closest("[data-no-persist]")) return false;
  return true;
}

/** Stabiele sleutel per pagina + veld. Radios op waarde; overige velden op de
 *  volgorde-index onder gelijknamige velden (uniek bij meerdere formulieren). */
function keyFor(pathname: string, el: Field): string {
  const name = el.name;
  const input = el as HTMLInputElement;
  if (el.tagName === "INPUT" && input.type === "radio") {
    return `${PREFIX}${pathname}::${name}=${input.value}`;
  }
  const same = document.getElementsByName(name);
  const occ = Array.prototype.indexOf.call(same, el);
  return `${PREFIX}${pathname}::${name}#${occ}`;
}

function isToggle(el: Field): boolean {
  return el.tagName === "INPUT" && ((el as HTMLInputElement).type === "checkbox" || (el as HTMLInputElement).type === "radio");
}

export function FormAutosave() {
  const pathname = usePathname();

  useEffect(() => {
    let store: Storage;
    try {
      store = window.sessionStorage;
      const t = "__q4s_probe";
      store.setItem(t, "1");
      store.removeItem(t);
    } catch {
      return; // opslag niet beschikbaar (privémodus e.d.) → stil overslaan
    }

    // Terugzetten ná de eerste paint, zodat de server-standaardwaarden er al staan
    // en we ze alleen overschrijven waar een concept bestaat.
    const raf = requestAnimationFrame(() => {
      document.querySelectorAll<Field>("input, textarea, select").forEach((el) => {
        if (!persistable(el)) return;
        const saved = store.getItem(keyFor(pathname, el));
        if (saved == null) return;
        if (isToggle(el)) {
          (el as HTMLInputElement).checked = saved === "1";
        } else if (el.value !== saved) {
          el.value = saved;
        }
      });
    });

    const save = (e: Event) => {
      if (!persistable(e.target)) return;
      const el = e.target as Field;
      try {
        if (isToggle(el)) {
          store.setItem(keyFor(pathname, el), (el as HTMLInputElement).checked ? "1" : "0");
        } else if (el.value) {
          store.setItem(keyFor(pathname, el), el.value);
        } else {
          store.removeItem(keyFor(pathname, el));
        }
      } catch {
        // quota bereikt → concept-opslag mag nooit het typen blokkeren
      }
    };

    const onSubmit = (e: Event) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      form.querySelectorAll<Field>("input, textarea, select").forEach((el) => {
        if (persistable(el)) store.removeItem(keyFor(pathname, el));
      });
    };

    document.addEventListener("input", save, true);
    document.addEventListener("change", save, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("input", save, true);
      document.removeEventListener("change", save, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [pathname]);

  return null;
}
