import { notFound } from "next/navigation";
import { GraduationCap, CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { DISCIPLINES, labelFor } from "@/lib/domain";
import { parseOptions } from "@/lib/vakproef";
import { AnswerForm } from "./AnswerForm";

export const metadata = { title: "Vakproef — Q4S" };

export default async function PubliekeVakproefPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ done?: string; ok?: string }>;
}) {
  const { slug } = await params;
  const { done, ok } = await searchParams;
  const challenge = await db.challenge.findUnique({ where: { slug } });
  if (!challenge) notFound();

  const options = parseOptions(challenge.optionsJson);
  const discipline = challenge.discipline
    ? labelFor(DISCIPLINES, challenge.discipline)
    : "Techniek";
  const isDone = done === "1";
  const wasCorrect = ok === "1";

  return (
    <main className="mx-auto max-w-2xl p-8">
      <article className="space-y-6">
        <header className="space-y-3 border-b border-ink-200 pb-6">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium uppercase tracking-wide text-brand-700">
            Q4S Vakproef · {discipline}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">
            {challenge.title}
          </h1>
        </header>

        {isDone ? (
          <div className="space-y-5">
            <div
              className={
                wasCorrect
                  ? "rounded-xl border border-emerald-200 bg-emerald-50 p-6"
                  : "rounded-xl border border-amber-200 bg-amber-50 p-6"
              }
            >
              <div className="flex items-start gap-3">
                {wasCorrect ? (
                  <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
                )}
                <div>
                  <h2
                    className={
                      wasCorrect
                        ? "text-lg font-semibold text-emerald-900"
                        : "text-lg font-semibold text-amber-900"
                    }
                  >
                    {wasCorrect ? "Goed gedaan! 🎯" : "Helaas, net niet."}
                  </h2>
                  <p className="mt-1 text-sm text-ink-700">
                    Het juiste antwoord:{" "}
                    <strong>{options[challenge.correctIndex] ?? "—"}</strong>
                  </p>
                  {challenge.explanation && (
                    <p className="mt-2 text-sm text-ink-600">{challenge.explanation}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-ink-200 bg-ink-50 p-6 text-sm text-ink-700">
              ✅ Je staat nu in de <strong>Q4S Talentpool</strong>. Zodra er een
              opdracht voorbijkomt die bij jouw vak past, nemen we als eerste
              contact met je op.
            </div>
          </div>
        ) : challenge.status === "ACTIVE" ? (
          <>
            <p className="whitespace-pre-wrap text-lg leading-relaxed text-ink-800">
              {challenge.question}
            </p>
            <AnswerForm
              slug={slug}
              options={options}
              defaultDiscipline={challenge.discipline}
            />
          </>
        ) : (
          <p className="rounded-xl border border-ink-200 bg-ink-50 p-6 text-sm text-ink-600">
            Deze vakproef is op dit moment gesloten. Houd onze socials in de gaten
            voor de volgende!
          </p>
        )}
      </article>
    </main>
  );
}
