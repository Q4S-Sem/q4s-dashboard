import Link from "next/link";
import { Award, AlertTriangle, XCircle, Mail, BellRing } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { certStatus, CERT_STATUS_META, type CertStatus } from "@/lib/evaluaties";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { sendCertificateReminder } from "./actions";
import { CertPeopleList, type CertPerson } from "./CertPeopleList";

export const metadata = { title: "Certificeringen" };
export const dynamic = "force-dynamic";

const ORDER: Record<CertStatus, number> = { expired: 0, expiring: 1, valid: 2, none: 3 };

type CertItem = { id: string; name: string; expiry: Date | null; reminderSentAt: Date | null };
type Folder = {
  id: string;
  name: string;
  href: string;
  tag: string | null;
  email: string | null;
  kind: "consultant" | "employee";
  certs: CertItem[];
};

export default async function CertificeringenPage() {
  const now = new Date();
  // Alle actieve consultants (ook zonder certificaten, zodat je ziet van wie de
  // certificering nog niet compleet is) én eigen medewerkers met een geüpload
  // diploma/certificaat. Zo staat álle certificering — extern personeel én eigen
  // loondienst — op één plek.
  const [consultants, employees] = await Promise.all([
    db.consultant.findMany({
      where: { active: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      include: { certificates: true },
    }),
    db.employee.findMany({
      where: { active: true, documents: { some: { category: "DIPLOMA" } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      include: { documents: { where: { category: "DIPLOMA" } } },
    }),
  ]);

  // Eigen loondienst-medewerkers die we detacheren hebben óók een (brug-)consultant
  // (Consultant.employeeId). Zou die zonder eigen certificaten verschijnen, dan
  // stond dezelfde persoon dubbel in de lijst — één lege consultant-map naast de
  // medewerker-map. Die lege duplicaten laten we weg; de medewerker-map is leidend.
  const bridgedEmployeeIds = new Set(employees.map((e) => e.id));
  const visibleConsultants = consultants.filter(
    (c) => !(c.employeeId && bridgedEmployeeIds.has(c.employeeId) && c.certificates.length === 0),
  );

  const folders: Folder[] = [
    ...visibleConsultants.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      href: `/certificeringen/${c.id}`,
      tag: null,
      email: c.email?.trim() || null,
      kind: "consultant" as const,
      certs: c.certificates.map((ct) => ({
        id: ct.id,
        name: ct.name,
        expiry: ct.expiryDate,
        reminderSentAt: ct.reminderSentAt,
      })),
    })),
    ...employees.map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      href: `/medewerkers/${e.id}`,
      tag: "Eigen medewerker",
      email: e.email?.trim() || null,
      kind: "employee" as const,
      certs: e.documents.map((d) => ({
        id: d.id,
        name: d.title,
        expiry: d.expiryDate,
        reminderSentAt: null,
      })),
    })),
  ].sort((a, b) => a.name.localeCompare(b.name, "nl"));

  // Totals.
  const allStatuses = folders.flatMap((f) => f.certs.map((ct) => certStatus(ct.expiry, now)));
  const totalCerts = allStatuses.length;
  const expiringTotal = allStatuses.filter((s) => s === "expiring").length;
  const expiredTotal = allStatuses.filter((s) => s === "expired").length;

  // Per-person rows (serializable for the client list).
  const people: CertPerson[] = folders.map((f) => {
    const sts = f.certs.map((ct) => certStatus(ct.expiry, now));
    const expired = sts.filter((s) => s === "expired").length;
    const expiring = sts.filter((s) => s === "expiring").length;
    const soonest = f.certs
      .map((ct) => ct.expiry)
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const worst: CertStatus = expired
      ? "expired"
      : expiring
        ? "expiring"
        : f.certs.length
          ? "valid"
          : "none";
    const badge =
      worst === "expired" || worst === "expiring"
        ? {
            color: CERT_STATUS_META[worst].color,
            label: expired ? `${expired} verlopen` : `${expiring} bijna`,
          }
        : f.certs.length > 0
          ? { color: "green" as const, label: "Op orde" }
          : null;
    return {
      id: f.id,
      name: f.name,
      count: f.certs.length,
      soonestLabel: soonest ? formatDate(soonest) : null,
      badge,
      href: f.href,
      tag: f.tag,
    };
  });

  // "Actie nodig" — expiring/expired across everyone.
  const alerts = folders
    .flatMap((f) =>
      f.certs.map((ct) => ({
        certId: ct.id,
        certName: ct.name,
        personName: f.name,
        href: f.href,
        kind: f.kind,
        hasEmail: Boolean(f.email),
        reminderSentAt: ct.reminderSentAt,
        expiry: ct.expiry,
        st: certStatus(ct.expiry, now),
      })),
    )
    .filter((x) => x.st === "expiring" || x.st === "expired")
    .sort((a, b) => {
      const d = ORDER[a.st] - ORDER[b.st];
      if (d !== 0) return d;
      return (a.expiry?.getTime() ?? 0) - (b.expiry?.getTime() ?? 0);
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificeringen"
        description="Een map per medewerker met al hun certificaten, verloopdatums en herinneringen."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Certificaten" value={totalCerts} icon={<Award className="h-5 w-5" />} />
        <StatCard
          label="Verloopt binnenkort"
          value={expiringTotal}
          sub="binnen 60 dagen"
          accent="amber"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard label="Verlopen" value={expiredTotal} accent="red" icon={<XCircle className="h-5 w-5" />} />
      </div>

      {/* Actie nodig */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-amber-500" /> Actie nodig — bijna of al verlopen
            </CardTitle>
            <span className="text-sm text-slate-500">{alerts.length}</span>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Medewerker</TH>
                  <TH>Certificaat</TH>
                  <TH>Vervaldatum</TH>
                  <TH>Status</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {alerts.map((a) => {
                  const meta = CERT_STATUS_META[a.st];
                  return (
                    <TR key={`${a.kind}-${a.certId}`}>
                      <TD className="font-medium text-slate-900">
                        {a.personName}
                        {a.kind === "employee" && (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                            eigen medewerker
                          </span>
                        )}
                      </TD>
                      <TD>{a.certName}</TD>
                      <TD>{formatDate(a.expiry)}</TD>
                      <TD>
                        <Badge color={meta.color}>{meta.label}</Badge>
                        {a.reminderSentAt && (
                          <span className="ml-2 text-xs text-slate-400">
                            herinnerd {formatDate(a.reminderSentAt)}
                          </span>
                        )}
                      </TD>
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {a.kind === "consultant" &&
                            (a.hasEmail ? (
                              <form action={sendCertificateReminder}>
                                <input type="hidden" name="id" value={a.certId} />
                                <SubmitButton size="sm" variant="outline" pendingLabel="Sturen…">
                                  <Mail className="h-4 w-4" /> Herinnering
                                </SubmitButton>
                              </form>
                            ) : (
                              <span className="text-xs text-amber-600">geen e-mail</span>
                            ))}
                          <Link
                            href={a.href}
                            className={buttonVariants({ variant: "ghost", size: "sm" })}
                          >
                            {a.kind === "employee" ? "Open dossier" : "Open map"}
                          </Link>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Mappen per medewerker — gesorteerd, onder elkaar, met naam-filter */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Mappen per medewerker
        </h2>
        <CertPeopleList people={people} />
      </div>
    </div>
  );
}
