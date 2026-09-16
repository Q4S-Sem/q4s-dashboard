"use client";

import * as React from "react";

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const plain = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 });

/**
 * Teller die bij het eerste zichtbaar worden van 0 naar de eindwaarde loopt
 * (~0,9s, ease-out). Respecteert prefers-reduced-motion: dan staat het
 * eindbedrag er direct. Server geeft alleen het getal + formaat door.
 */
export function CountUpValue({
  value,
  format = "currency",
  suffix,
}: {
  value: number;
  format?: "currency" | "number";
  suffix?: string;
}) {
  const fmt = React.useCallback(
    (n: number) => (format === "currency" ? euro.format(n) : plain.format(n)),
    [format],
  );
  // Start met de eindwaarde (SSR + no-JS + reduced motion zien meteen het echte getal).
  const [text, setText] = React.useState(() => fmt(value));
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(fmt(value));
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const dur = 900;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setText(fmt(value * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, fmt]);

  return (
    <span ref={ref} className="tabular-nums">
      {text}
      {suffix}
    </span>
  );
}
