"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BotMessageSquare, X, Send, ArrowRight } from "lucide-react";
import { askAssistant, type AssistantReply, type AssistantCandidate } from "@/lib/assistant";
import { DISCIPLINES, labelFor } from "@/lib/domain";
import { cn } from "@/lib/utils";

type Msg = {
  role: "user" | "assistant";
  text: string;
  route?: string | null;
  routeLabel?: string | null;
  results?: AssistantCandidate[];
};

const SUGGESTIONS = [
  "Ik zoek een lasser die nu beschikbaar is",
  "Welke fitters zijn binnenkort beschikbaar?",
  "Hoe zet ik een factuur klaar?",
];

const AVAIL_DOT: Record<string, string> = {
  BESCHIKBAAR: "bg-emerald-500",
  BINNENKORT: "bg-amber-500",
  NIET_BESCHIKBAAR: "bg-red-500",
  ONBEKEND: "bg-ink-300",
};

/**
 * Globale AI-assistent (rechtsonder). Beantwoordt vragen over het dashboard en
 * brengt je met één klik naar de juiste pagina. Werkt op elke pagina.
 */
export function AskAi() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  // Verberg de zwevende knop op formulier-/bewerk-pagina's (nieuw, bewerken,
  // importeren, instellingen) — daar botst hij met de "Opslaan"-knop rechtsonder.
  const isFormPage =
    /\/(nieuw|bewerken|importeren)(\/|$)/.test(pathname) || pathname.endsWith("/instellingen");
  if (isFormPage) return null;

  async function ask(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setPending(true);
    try {
      const reply: AssistantReply = await askAssistant(q);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: reply.answer,
          route: reply.route,
          routeLabel: reply.routeLabel,
          results: reply.results,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Er ging iets mis. Probeer het later opnieuw." },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="no-print">
      {/* Zwevende knop */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask AI openen"
          className="group fixed bottom-5 right-5 z-40 inline-flex items-center gap-2.5 rounded-full bg-ink-900 py-2 pl-2 pr-4 text-sm font-semibold text-white shadow-lg ring-1 ring-white/10 transition-all hover:-translate-y-0.5 hover:bg-ink-800 hover:shadow-xl"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500 text-white shadow-inner transition-transform group-hover:scale-105">
            <BotMessageSquare className="h-[18px] w-[18px]" />
          </span>
          Ask AI
        </button>
      )}

      {/* Chatpaneel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl ring-1 ring-black/5">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <span className="inline-flex items-center gap-2 font-semibold text-ink-900">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                <BotMessageSquare className="h-3.5 w-3.5" />
              </span>
              Ask AI
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Sluiten"
              className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-ink-500">
                  Stel een vraag of zoek kandidaten — bijv. “ik zoek een lasser die nu beschikbaar is”. Ik doorzoek de database of breng je naar de juiste pagina.
                </p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => ask(s)}
                      className="rounded-lg border border-ink-200 px-3 py-2 text-left text-sm text-ink-600 transition-colors hover:border-ink-300 hover:bg-ink-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-600 px-3 py-2 text-sm text-white"
                      : "max-w-[85%] space-y-2 rounded-2xl rounded-bl-sm bg-ink-100 px-3 py-2 text-sm text-ink-800"
                  }
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.role === "assistant" && m.results && m.results.length > 0 && (
                    <div className="space-y-1.5">
                      {m.results.map((r) => (
                        <Link
                          key={r.id}
                          href={`/kandidaten/${r.id}`}
                          onClick={() => setOpen(false)}
                          className="block rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "h-2 w-2 shrink-0 rounded-full",
                                AVAIL_DOT[r.availability] ?? "bg-ink-300",
                              )}
                            />
                            <span className="truncate text-sm font-medium text-ink-900">{r.name}</span>
                          </div>
                          {(r.discipline || r.location || r.headline) && (
                            <p className="mt-0.5 truncate pl-4 text-xs text-ink-500">
                              {[r.discipline ? labelFor(DISCIPLINES, r.discipline) : null, r.location, r.headline]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                  {m.role === "assistant" && m.route && (
                    <Link
                      href={m.route}
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-ink-800"
                    >
                      {m.routeLabel ?? "Ga naar pagina"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            ))}

            {pending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-ink-100 px-3 py-2 text-sm text-ink-400">
                  Aan het denken…
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex items-center gap-2 border-t border-ink-100 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Stel een vraag…"
              aria-label="Bericht aan Ask AI"
              className="min-w-0 flex-1 rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              aria-label="Versturen"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-white transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
