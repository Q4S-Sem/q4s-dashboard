import { headers } from "next/headers";
import {
  MousePointerClick,
  UserPlus,
  CheckCircle2,
  Percent,
  Plus,
  Trash2,
  LinkIcon,
  Share2,
  Radio,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { CopyLink } from "@/components/copy-link";
import { formatDate } from "@/lib/utils";
import { RECRUITMENT_CHANNELS } from "@/lib/domain";
import { createPostLink, createChannelLinks, deletePostLink } from "./actions";

export const metadata = { title: "Talentpool — links & analytics" };

function conv(signups: number, clicks: number): string {
  return clicks > 0 ? `${Math.round((signups / clicks) * 100)}%` : "—";
}

export default async function TalentpoolAnalyticsPage() {
  const [links, signupRows, placedApps, totalSignups, totalPlacements, posts] =
    await Promise.all([
      db.postLink.findMany({ orderBy: { createdAt: "desc" } }),
      db.candidate.groupBy({
        by: ["sourceDetail"],
        where: { source: "TALENTPOOL", sourceDetail: { not: null } },
        _count: { _all: true },
      }),
      db.application.findMany({
        where: {
          status: "PLACED",
          candidate: { source: "TALENTPOOL", sourceDetail: { not: null } },
        },
        select: { candidate: { select: { sourceDetail: true } } },
      }),
      db.candidate.count({ where: { source: "TALENTPOOL" } }),
      db.application.count({
        where: { status: "PLACED", candidate: { source: "TALENTPOOL" } },
      }),
      db.socialPost.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, title: true },
      }),
    ]);

  const signupsByToken = new Map<string, number>();
  for (const r of signupRows) {
    if (r.sourceDetail) signupsByToken.set(r.sourceDetail, r._count._all);
  }
  const placementsByToken = new Map<string, number>();
  for (const a of placedApps) {
    const t = a.candidate.sourceDetail;
    if (t) placementsByToken.set(t, (placementsByToken.get(t) ?? 0) + 1);
  }

  // Roll up per channel — the "which channel works" answer.
  const byChannel = new Map<
    string,
    { clicks: number; signups: number; placements: number }
  >();
  for (const l of links) {
    const ch = l.channel ?? "OVERIG";
    const a = byChannel.get(ch) ?? { clicks: 0, signups: 0, placements: 0 };
    a.clicks += l.clicks;
    a.signups += signupsByToken.get(l.token) ?? 0;
    a.placements += placementsByToken.get(l.token) ?? 0;
    byChannel.set(ch, a);
  }
  const channelRows = [...byChannel.entries()]
    .map(([channel, agg]) => ({ channel, ...agg }))
    .sort((a, b) => b.signups - a.signups || b.placements - a.placements || b.clicks - a.clicks);

  const totalClicks = links.reduce((s, l) => s + l.clicks, 0);
  const overallConv =
    totalClicks > 0 ? Math.round((totalSignups / totalClicks) * 100) : null;

  // Absolute base URL for the trackable links.
  const h = await headers();
  const host = h.get("host") ?? "";
  const proto =
    host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  const envBase = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const base = envBase || (host ? `${proto}://${host}` : "");
  const fullUrl = (token: string) => `${base}/v/${token}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Talentpool — links & analytics"
        description="Eén getrackte link per kanaal. Zie zwart-op-wit welk kanaal aanmeldingen én plaatsingen oplevert."
        actions={
          <form action={createChannelLinks}>
            <SubmitButton variant="outline">
              <Share2 className="h-4 w-4" /> Links voor alle kanalen
            </SubmitButton>
          </form>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Clicks" value={totalClicks} icon={<MousePointerClick className="h-5 w-5" />} accent="brand" />
        <StatCard label="Aanmeldingen" value={totalSignups} icon={<UserPlus className="h-5 w-5" />} accent="violet" />
        <StatCard label="Plaatsingen" value={totalPlacements} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" />
        <StatCard label="Conversie" value={overallConv === null ? "—" : `${overallConv}%`} icon={<Percent className="h-5 w-5" />} accent="amber" />
      </div>

      {/* Per-channel rollup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-brand-600" /> Per kanaal
          </CardTitle>
          <span className="text-xs text-ink-400">gesorteerd op aanmeldingen</span>
        </CardHeader>
        {channelRows.length === 0 ? (
          <CardContent className="text-sm text-ink-500">
            Nog geen kanalen. Klik op <strong>Links voor alle kanalen</strong> om te
            starten.
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Kanaal</TH>
                <TH className="text-right">Clicks</TH>
                <TH className="text-right">Aanmeldingen</TH>
                <TH className="text-right">Plaatsingen</TH>
                <TH className="text-right">Conversie</TH>
              </TR>
            </THead>
            <TBody>
              {channelRows.map((r, i) => {
                const isBest = i === 0 && r.signups > 0;
                return (
                  <TR key={r.channel} className={isBest ? "bg-emerald-50/70" : undefined}>
                    <TD>
                      <div className="flex items-center gap-2">
                        <StatusBadge options={RECRUITMENT_CHANNELS} value={r.channel} />
                        {isBest && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            Beste kanaal
                          </span>
                        )}
                      </div>
                    </TD>
                    <TD className="text-right tabular-nums">{r.clicks}</TD>
                    <TD className="text-right tabular-nums">{r.signups}</TD>
                    <TD className="text-right tabular-nums">{r.placements}</TD>
                    <TD className="text-right font-medium tabular-nums">
                      {conv(r.signups, r.clicks)}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      {/* New tracked link */}
      <Card>
        <CardHeader>
          <CardTitle>Nieuwe getrackte link</CardTitle>
        </CardHeader>
        <form action={createPostLink}>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Label" htmlFor="label" required>
              <Input id="label" name="label" placeholder="Bijv. LinkedIn — lasser-campagne" required />
            </Field>
            <Field label="Kanaal" htmlFor="channel">
              <Select id="channel" name="channel" defaultValue="">
                <option value="">— kies kanaal —</option>
                {RECRUITMENT_CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Koppel aan post" htmlFor="socialPostId" hint="Optioneel.">
              <Select id="socialPostId" name="socialPostId" defaultValue="">
                <option value="">— geen —</option>
                {posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Bestemming" htmlFor="destination" hint="Interne pagina waar de link heen leidt.">
              <Input id="destination" name="destination" defaultValue="/talentpool" />
            </Field>
            <div className="flex items-end">
              <SubmitButton>
                <Plus className="h-4 w-4" /> Link aanmaken
              </SubmitButton>
            </div>
          </CardContent>
        </form>
      </Card>

      {/* All links */}
      <Card>
        <CardHeader>
          <CardTitle>Alle getrackte links</CardTitle>
        </CardHeader>
        {links.length === 0 ? (
          <EmptyState
            icon={<LinkIcon className="h-6 w-6" />}
            title="Nog geen getrackte links"
            description="Maak per kanaal een link en zet 'm in je post. Elke klik en aanmelding wordt dan gemeten."
            className="border-0"
          />
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Label</TH>
                <TH>Kanaal</TH>
                <TH>Getrackte link</TH>
                <TH className="text-right">Clicks</TH>
                <TH className="text-right">Aanm.</TH>
                <TH className="text-right">Plaats.</TH>
                <TH className="text-right">Conv.</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {links.map((l) => {
                const signups = signupsByToken.get(l.token) ?? 0;
                const placements = placementsByToken.get(l.token) ?? 0;
                return (
                  <TR key={l.id}>
                    <TD>
                      <div className="font-medium text-ink-900">{l.label}</div>
                      <div className="text-xs text-ink-400">
                        aangemaakt {formatDate(l.createdAt)}
                      </div>
                    </TD>
                    <TD>
                      {l.channel ? (
                        <StatusBadge options={RECRUITMENT_CHANNELS} value={l.channel} />
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </TD>
                    <TD>
                      <CopyLink url={fullUrl(l.token)} className="max-w-xs" />
                    </TD>
                    <TD className="text-right tabular-nums">{l.clicks}</TD>
                    <TD className="text-right tabular-nums">{signups}</TD>
                    <TD className="text-right tabular-nums">{placements}</TD>
                    <TD className="text-right font-medium tabular-nums">
                      {conv(signups, l.clicks)}
                    </TD>
                    <TD className="text-right">
                      <ConfirmSubmit
                        action={deletePostLink}
                        id={l.id}
                        message={`Link "${l.label}" verwijderen? De statistieken gaan verloren.`}
                        variant="ghost"
                        size="icon"
                      >
                        <Trash2 className="h-4 w-4" />
                      </ConfirmSubmit>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
