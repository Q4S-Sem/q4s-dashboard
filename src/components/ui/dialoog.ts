import { cn } from "@/lib/utils";

/**
 * Eén stijl voor elke waarschuwing/bevestiging in het dashboard (ConfirmSubmit,
 * ConfirmSave, ConfirmCancel, UnsavedGuard): rustig wit vlak, icoon in een
 * zachte ring, titel + uitleg, knoppen op volle breedte naast elkaar.
 */
export const DIALOOG = {
  laag: "fixed inset-0 z-[100] flex items-center justify-center p-4",
  achter: "animate-overlay-in fixed inset-0 bg-ink-900/40 backdrop-blur-[2px]",
  paneel:
    "animate-dialog-in relative z-10 w-full max-w-[420px] rounded-xl border border-ink-200 bg-white p-6 shadow-[0_24px_60px_-16px_rgb(0_0_0/0.3)]",
  titel: "text-[15px] font-semibold leading-snug text-ink-900",
  uitleg: "mt-1.5 text-[13px] leading-relaxed text-ink-500",
  knoppen: "mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:[&>button]:flex-1",
};

export function dialoogIcoon(toon: "rood" | "amber") {
  return cn(
    "mb-4 flex h-10 w-10 items-center justify-center rounded-full ring-[6px] [&_svg]:h-[18px] [&_svg]:w-[18px]",
    toon === "rood" ? "bg-red-50 text-red-600 ring-red-50/60" : "bg-amber-50 text-amber-600 ring-amber-50/60",
  );
}
