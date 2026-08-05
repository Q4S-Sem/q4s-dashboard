import { notFound } from "next/navigation";
import { FileText, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { DISCIPLINES, labelFor } from "@/lib/domain";
import { formatDateLong } from "@/lib/utils";
import { ApplyForm } from "./ApplyForm";

export const metadata = { title: "Vacature" };
export const dynamic = "force-dynamic"; // count every visit

function lines(s: string | null): string[] {
  if (!s) return [];
  return s
    .split("\n")
    .map((x) => x.trim().replace(/^[-•*]\s*/, ""))
    .filter(Boolean);
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-wider text-ink-900">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-ink-900">{value}</p>
    </div>
  );
}

export default async function PubliekeVacaturePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { slug } = await params;
  const { ok } = await searchParams;
  const vacancy = await db.vacancy.findUnique({
    where: { slug },
    include: { client: true },
  });

  if (!vacancy || vacancy.status !== "PUBLISHED") notFound();

  // Count the website click (best-effort — never breaks the page).
  await db.vacancy
    .update({ where: { slug }, data: { views: { increment: 1 } } })
    .catch(() => {});

  const company = vacancy.client?.companyName ?? vacancy.companyName ?? null;
  const discipline = labelFor(DISCIPLINES, vacancy.discipline);
  const meta = [discipline, vacancy.location, vacancy.employmentType].filter(
    (v) => v && v !== "—",
  );

  const werk = lines(vacancy.responsibilities);
  const eisen = lines(vacancy.requirements);
  const pre = lines(vacancy.niceToHave);
  const hasStructured =
    Boolean(vacancy.summary) || werk.length > 0 || eisen.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="space-y-3 border-b border-ink-200 pb-6">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
          <FileText className="h-5 w-5" />
        </div>
        {company && (
          <p className="text-sm font-medium uppercase tracking-wide text-brand-700">
            {company}
          </p>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">
          {vacancy.title}
        </h1>
        {meta.length > 0 && (
          <p className="text-sm text-ink-500">{meta.join(" · ")}</p>
        )}
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Inhoud */}
        <article className="space-y-8">
          {vacancy.summary && (
            <Section title="Over de functie">
              <p className="leading-relaxed text-ink-700">{vacancy.summary}</p>
            </Section>
          )}

          {werk.length > 0 && (
            <Section title="Werkzaamheden">
              <ul className="space-y-2">
                {werk.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {eisen.length > 0 && (
            <Section title="Functie-eisen">
              <ul className="space-y-2">
                {eisen.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ink-300" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {pre.length > 0 && (
            <Section title="Pré">
              <ul className="space-y-2">
                {pre.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-600">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Fallback: nothing structured filled in, but we do have a full text. */}
          {!hasStructured && vacancy.improvedText && (
            <div className="whitespace-pre-wrap leading-relaxed text-ink-800">
              {vacancy.improvedText}
            </div>
          )}
        </article>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-ink-200 p-5">
            <h2 className="font-semibold text-ink-900">Direct solliciteren</h2>
            <p className="mt-1 text-sm text-ink-500">
              Stuur je CV en motivatie naar ons toe of neem contact op voor meer
              informatie.
            </p>
            <a
              href="#solliciteren"
              className="mt-4 flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white hover:bg-brand-700"
            >
              Solliciteer nu
            </a>
            <a
              href="#solliciteren"
              className="mt-2 flex w-full items-center justify-center rounded-lg border border-ink-300 bg-white px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-ink-700 hover:bg-ink-50"
            >
              CV uploaden
            </a>
          </div>

          <div className="rounded-xl border border-ink-200 p-5">
            <h2 className="font-semibold text-ink-900">Details</h2>
            <div className="mt-3 space-y-3">
              <DetailRow label="Locatie" value={vacancy.location} />
              <DetailRow label="Contractvorm" value={vacancy.employmentType} />
              <DetailRow
                label="Discipline"
                value={discipline !== "—" ? discipline : null}
              />
              <DetailRow label="Vergoeding" value={vacancy.salary} />
              <DetailRow
                label="Geplaatst"
                value={
                  vacancy.publishedAt ? formatDateLong(vacancy.publishedAt) : null
                }
              />
            </div>
          </div>
        </aside>
      </div>

      <section id="solliciteren" className="mt-10 scroll-mt-8">
        <ApplyForm vacancyId={vacancy.id} slug={slug} ok={Boolean(ok)} />
      </section>
    </main>
  );
}
