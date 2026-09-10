"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isOnlineNow } from "./online-status";

// Globale "concept blijft bewaard": terwijl je in een formulier typt worden de
// veldwaarden per pagina in localStorage opgeslagen, en bij terugkomst op die
// pagina automatisch teruggezet — zodat je niets kwijtraakt als je even naar een
// andere pagina navigeert of de app een update-reload doet. Bij het (succesvol)
// verzenden van een formulier wordt het concept van dát formulier gewist. Werkt
// op ELK formulier, zonder per-form code, luisterend op document-niveau.
//
// Belangrijk: veel formulieren zijn REACT-CONTROLLED (waarde via useState). Bij
// het terugzetten zetten we daarom niet alleen el.value, maar via de native
// setter + een 'input'-event, zodat React zijn state meeneemt (anders overschrijft
// React de waarde meteen weer met de lege state). Bij het opslaan scannen we óók
// bij het verlaten/verbergen van de pagina alle velden, zodat waarden die de code
// zelf invult (bijv. een CV dat door AI is uitgelezen) net zo goed bewaard blijven.
//
// Privacy: het concept staat alleen op dit apparaat (localStorage) en wordt bij
// een geslaagde verzending gewist; wachtwoord-, bestands- en verborgen velden
// worden nooit opgeslagen. Zet `data-no-persist` op een veld of formulier om het
// uit te sluiten.

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
  return (
    el.tagName === "INPUT" &&
    ((el as HTMLInputElement).type === "checkbox" || (el as HTMLInputElement).type === "radio")
  );
}

/** Zet een waarde zó dat React (controlled inputs) het meeneemt: via de native
 *  value-setter en daarna een 'input'-event, zodat de onChange-handler van React
 *  vuurt en zijn state bijwerkt. Zonder dit zou React de waarde meteen terugzetten. */
function setNativeValue(el: Field, value: string) {
  const proto =
    el.tagName === "TEXTAREA"
      ? HTMLTextAreaElement.prototype
      : el.tagName === "SELECT"
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function setNativeChecked(el: HTMLInputElement, checked: boolean) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
  if (setter) setter.call(el, checked);
  else el.checked = checked;
  el.dispatchEvent(new Event("click", { bubbles: true }));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export function FormAutosave() {
  const pathname = usePathname();

  useEffect(() => {
    let store: Storage;
    try {
      store = window.localStorage;
      const t = "__q4s_probe";
      store.setItem(t, "1");
      store.removeItem(t);
    } catch {
      return; // opslag niet beschikbaar (privémodus e.d.) → stil overslaan
    }

    // Terugzetten ná de eerste paint én ná hydratie, zodat React zijn handlers al
    // heeft en onze 'input'-events oppikt. We doen het in twee stappen (rAF +
    // korte timeout) om zeker te zijn dat controlled inputs klaar zijn.
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      document.querySelectorAll<Field>("input, textarea, select").forEach((el) => {
        if (!persistable(el)) return;
        const saved = store.getItem(keyFor(pathname, el));
        if (saved == null) return;
        if (isToggle(el)) {
          const want = saved === "1";
          if ((el as HTMLInputElement).checked !== want) setNativeChecked(el as HTMLInputElement, want);
        } else if (el.value !== saved) {
          setNativeValue(el, saved);
        }
      });
    };
    const raf = requestAnimationFrame(() => setTimeout(restore, 60));

    const saveField = (el: Field) => {
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

    const save = (e: Event) => {
      if (!persistable(e.target)) return;
      saveField(e.target as Field);
    };

    // Scan ALLE velden en bewaar hun huidige waarde. Vangt óók waarden die de code
    // zelf invult (AI-uitlezing) — die geven geen input-event. Draaien we bij het
    // verlaten/verbergen van de pagina en vlak vóór een update-reload.
    const saveAll = () => {
      document.querySelectorAll<Field>("input, textarea, select").forEach((el) => {
        if (persistable(el)) saveField(el);
      });
    };

    const onSubmit = (e: Event) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      // Offline houdt OfflineGuard het verzenden tegen; het concept moet dan
      // juist blijven staan, anders raak je het alsnog kwijt.
      if (!isOnlineNow()) return;
      form.querySelectorAll<Field>("input, textarea, select").forEach((el) => {
        if (persistable(el)) store.removeItem(keyFor(pathname, el));
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") saveAll();
    };

    document.addEventListener("input", save, true);
    document.addEventListener("change", save, true);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", saveAll);
    window.addEventListener("beforeunload", saveAll);

    return () => {
      cancelAnimationFrame(raf);
      // Bij het weg-navigeren binnen de SPA nog één keer alles vastleggen.
      saveAll();
      document.removeEventListener("input", save, true);
      document.removeEventListener("change", save, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", saveAll);
      window.removeEventListener("beforeunload", saveAll);
    };
  }, [pathname]);

  return null;
}
