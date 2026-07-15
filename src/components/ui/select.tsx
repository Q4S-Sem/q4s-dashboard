"use client";

import * as React from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Opt = { value: string; label: string; disabled?: boolean; color?: string };

/** BadgeColor-token → gekleurd stipje, voor opties met een `data-color`. */
const DOT_CLASS: Record<string, string> = {
  slate: "bg-slate-400",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
  cyan: "bg-cyan-500",
};

/** Flatten an option's children (e.g. `{firstName} {lastName}`) into one label. */
function labelOf(children: React.ReactNode): string {
  if (children == null || children === false) return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(labelOf).join("");
  return "";
}

/** Read <option value>label</option> children into plain data. */
function readOptions(children: React.ReactNode): Opt[] {
  const out: Opt[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const p = child.props as {
      value?: string | number;
      disabled?: boolean;
      children?: React.ReactNode;
      "data-color"?: string;
    };
    const value = p.value === undefined ? "" : String(p.value);
    const label = labelOf(p.children) || value;
    out.push({ value, label, disabled: p.disabled, color: p["data-color"] });
  });
  return out;
}

const triggerBase =
  "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50";

/**
 * Themed, rounded select that replaces the native one (whose popup the browser
 * renders un-stylable). Keeps the same <option>-children API + a hidden input,
 * so every existing form keeps working and submits identically.
 */
export function Select({
  id,
  name,
  defaultValue,
  disabled,
  className,
  children,
  onValueChange,
  ...rest
}: {
  id?: string;
  name?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  onValueChange?: (value: string) => void;
  "aria-label"?: string;
}) {
  const options = React.useMemo(() => readOptions(children), [children]);
  const [value, setValue] = React.useState<string>(
    () => defaultValue ?? options[0]?.value ?? "",
  );
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // Selectable (non-placeholder) options for the popup + keyboard nav.
  const items = React.useMemo(() => options.filter((o) => !o.disabled), [options]);
  const current = options.find((o) => o.value === value);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  React.useEffect(() => {
    if (open) {
      const idx = items.findIndex((o) => o.value === value);
      // Sync the active row to the selected value each time the popup opens.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActive(idx >= 0 ? idx : 0);
    }
  }, [open, items, value]);

  function choose(v: string) {
    setValue(v);
    setOpen(false);
    onValueChange?.(v);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      // Sluit alleen de dropdown; laat een omliggende popover/dialog open.
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = items[active];
      if (o) choose(o.value);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-label={rest["aria-label"]}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={cn(triggerBase, open && "border-brand-500 ring-2 ring-brand-500/30")}
      >
        <span className={cn("flex items-center gap-2 truncate", !current?.value && "text-slate-400")}>
          {current?.color && DOT_CLASS[current.color] && (
            <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT_CLASS[current.color])} />
          )}
          <span className="truncate">{current?.label ?? "—"}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {items.map((o, i) => {
            const selected = o.value === value;
            return (
              <button
                key={`${o.value}-${i}`}
                type="button"
                onClick={() => choose(o.value)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                  selected ? "bg-brand-50 font-medium text-brand-700" : "text-slate-700",
                  active === i && !selected && "bg-slate-100",
                  active === i && selected && "bg-brand-100",
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  {o.color && DOT_CLASS[o.color] && (
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT_CLASS[o.color])} />
                  )}
                  <span className="truncate">{o.label}</span>
                </span>
                {selected && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
