import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, ExternalLink, Megaphone, MousePointerClick, Plus, Sparkles, Trash2, UserPlus, Users } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Field, Input, Select } from "@/components/ui/field";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { RECRUITMENT_CHANNELS, SOCIAL_PLATFORMS, SOCIAL_POST_STATUSES, labelFor } from "@/lib/domain";
import { generateTalentpoolPost, verwijderKanaal, voegKanaalToe, werkVolgersBij } from "./actions";

// ---------------------------------------------------------------------------
// SOCIALS — de marketingafdeling op één scherm: kanalen + volgers, wat er
// gepland staat, welke online vacatures nog geen post hebben, en wat de
// campagnelinks opleveren. Posts maken/plannen: /posts; teksten en beelden:
// /website/linkedin; campagnelinks: /socials/talentpool.
// ---------------------------------------------------------------------------

export const metadata = { title: "Socials" };
export const dynamic = "force-dynamic";

const getal = new Intl.NumberFormat("nl-NL");

export default async function SocialsPage({ searchParams }: { searchParams: Promise<{ fout?: string; vac?: string }> }) {
  const sp = await searchParams;
  // Oude links "/socials?vac=…" openden de tekstgenerator voor die vacature.
  if (sp.vac) redirect(`/website/linkedin?vac=${sp.vac}`);
  const maandStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [kanalen, gepland, concepten, gepubliceerd, links, aanmeldingen, zonderPost] = await Promise.all([
    db.socialChannel.findMany({ orderBy: [{ followers: "desc" }] }),
    db.socialPost.findMany({
      where: { status: "SCHEDULED" },
      orderBy: { scheduledFor: "asc" },
      take: 8,
      select: { id: true, title: true, platform: true, status: true, scheduledFor: true },
    }),
    db.socialPost.findMany({
      where: { status: "DRAFT" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, platform: true, status: true, scheduledFor: true },
    }),
    db.socialPost.count({ where: { status: "PUBLISHED", publishedAt: { gte: maandStart } } }),
    db.postLink.aggregate({ _sum: { clicks: true } }),
    db.candidate.count({ where: { source: "TALENTPOOL", createdAt: { gte: maandStart } } }),
    // Online vacatures waar nog geen enkele post van is: marketingkans.
    db.vacancy.findMany({
      where: { status: "PUBLISHED", socialPosts: { none: {} } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, title: true, location: true },
    }),
  ]);
  const volgersTotaal = kanalen.reduce((s, k) => s + k.followers, 0);
  const planning = [...gepland, ...concepten];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Socials"
        description="Kanalen bijhouden, posts plannen, teksten genereren en zien wat het oplevert."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <form action={generateTalentpoolPost}>
              <Button type="submit" variant="outline">
                <Sparkles /> Talentpool-post genereren
              </Button>
            </form>
            <Link href="/posts/nieuw" className={buttonVariants()}>
              <Plus /> Nieuwe post
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Volgers totaal" value={getal.format(volgersTotaal)} icon={<Users className="h-5 w-5" />} accent="brand" />
        <StatCard label="Gepost deze maand" value={gepubliceerd} icon={<Megaphone className="h-5 w-5" />} accent="violet" />
        <StatCard label="Klikken op campagnelinks" value={getal.format(links._sum.clicks ?? 0)} icon={<MousePointerClick className="h-5 w-5" />} accent="amber" />
        <StatCard label="Aanmeldingen talentpool (maand)" value={aanmeldingen} icon={<UserPlus className="h-5 w-5" />} accent="green" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kanalen</CardTitle>
          <span className="text-xs text-ink-400">werk de volgers bij wanneer je ze checkt — de groei wordt bijgehouden</span>
        </CardHeader>
        <CardContent className="space-y-4">
          {kanalen.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Kanaal</TH>
                    <TH>Platform</TH>
                    <TH className="text-right">Volgers</TH>
                    <TH className="text-right">Groei</TH>
                    <TH>Bijgewerkt</TH>
                    <TH className="w-72">Nieuw aantal</TH>
                    <TH className="w-10" />
                  </TR>
                </THead>
                <TBody>
                  {kanalen.map((k) => {
                    const groei = k.followers - k.prevFollowers;
                    return (
                      <TR key={k.id}>
                        <TD className="font-medium text-ink-900">
                          {k.url ? (
                            <a href={k.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                              {k.name} <ExternalLink className="h-3.5 w-3.5 text-ink-400" />
                            </a>
                          ) : (
                            k.name
                          )}
                        </TD>
                        <TD>
                          <StatusBadge options={RECRUITMENT_CHANNELS} value={k.platform} />
                        </TD>
                        <TD className="text-right font-semibold tabular-nums">{getal.format(k.followers)}</TD>
                        <TD className={cn("text-right tabular-nums", groei > 0 ? "text-emerald-700" : groei < 0 ? "text-red-600" : "text-ink-300")}>
                          {groei === 0 ? "—" : `${groei > 0 ? "+" : ""}${getal.format(groei)}`}
                        </TD>
                        <TD className="whitespace-nowrap text-ink-500">{formatDate(k.updatedAt)}</TD>
                        <TD>
                          <form action={werkVolgersBij} className="flex gap-2">
                            <input type="hidden" name="id" value={k.id} />
                            <Input name="followers" inputMode="numeric" defaultValue={k.followers} aria-label={`Volgers ${k.name}`} className="h-8" />
                            <Button type="submit" size="sm" variant="outline">
                              Opslaan
                            </Button>
                          </form>
                        </TD>
                        <TD>
                          <form action={verwijderKanaal}>
                            <input type="hidden" name="id" value={k.id} />
                            <button type="submit" aria-label={`${k.name} verwijderen`} className={buttonVariants({ variant: "ghost", size: "icon" })}>
                              <Trash2 />
                            </button>
                          </form>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          )}
          {sp.fout === "kanaal" && <p className="text-[13px] text-red-600">Geef het kanaal een naam.</p>}
          <form action={voegKanaalToe} className="grid gap-3 sm:grid-cols-[160px_1fr_1fr_120px_auto] sm:items-end">
            <Field label="Platform" htmlFor="platform">
              <Select id="platform" name="platform" defaultValue="LINKEDIN">
                {RECRUITMENT_CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Naam" htmlFor="name">
              <Input id="name" name="name" placeholder="bv. Q4S bedrijfspagina" required />
            </Field>
            <Field label="Link" htmlFor="url">
              <Input id="url" name="url" placeholder="linkedin.com/company/q4s" />
            </Field>
            <Field label="Volgers" htmlFor="followers">
              <Input id="followers" name="followers" inputMode="numeric" placeholder="0" />
            </Field>
            <Button type="submit">
              <Plus /> Kanaal
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-ink-400" /> Planning & concepten
            </CardTitle>
            <Link href="/posts" className="text-xs font-medium text-ink-500 hover:text-ink-900 hover:underline">
              Alle posts →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {planning.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-ink-400">Niets gepland. Maak een nieuwe post of genereer er een.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {planning.map((p) => (
                  <li key={p.id}>
                    <Link href={`/posts/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-ink-50">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink-900">{p.title}</span>
                        <span className="text-xs text-ink-500">
                          {labelFor(SOCIAL_PLATFORMS, p.platform)}
                          {p.scheduledFor ? ` · ${formatDate(p.scheduledFor)}` : ""}
                        </span>
                      </span>
                      <StatusBadge options={SOCIAL_POST_STATUSES} value={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-ink-400" /> Online vacatures zonder post
            </CardTitle>
            <span className="text-xs text-ink-400">maak er een tekst + beeld van</span>
          </CardHeader>
          <CardContent className="p-0">
            {zonderPost.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-ink-400">Elke online vacature heeft al een post.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {zonderPost.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink-900">{v.title}</span>
                      {v.location && <span className="text-xs text-ink-500">{v.location}</span>}
                    </span>
                    <Link href={`/website/linkedin?vac=${v.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      <Sparkles /> Tekst maken
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
