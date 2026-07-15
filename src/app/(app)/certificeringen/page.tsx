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

export default async function CertificeringenPage() {
  const now = new Date();
  // Alle actieve werkers — ook zonder plaatsing of (nog) zonder certificaten, zodat
  // je meteen ziet van wie we de certificering nog niet compleet in beeld hebben.
  const consultants = await db.consultant.findMany({
    where: { active: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    include: { certificates: true },
  });

  // Totals.
  const allStatuses = consultants.flatMap((c) =>
    c.certificates.map((ct) => certStatus(ct.expiryDate, now)),
  );
  const totalCerts = allStatuses.length;
  const expiringTotal = allStatuses.filter((s) => s === "expiring").length;
  const expiredTotal = allStatuses.filter((s) => s === "expired").length;

  // Per-person rows (serializable for the client list).
  const people: CertPerson[] = consultants.map((c) => {
    const sts = c.certificates.map((ct) => certStatus(ct.expiryDate, now));
    const expired = sts.filter((s) => s === "expired").length;
    const expiring = sts.filter((s) => s === "expiring").length;
    const soonest = c.certificates
      .map((ct) => ct.expiryDate)
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const worst: CertStatus = expired
      ? "expired"
      : expiring
        ? "expiring"
        : c.certificates.length
          ? "valid"
          : "none";
    const badge =
      worst === "expired" || worst === "expiring"
        ? {
            color: CERT_STATUS_META[worst].color,
            label: expired ? `${expired} verlopen` : `${expiring} bijna`,
          }
        : c.certificates.length > 0
          ? { color: "green" as const, label: "Op orde" }
          : null;
    return {
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      count: c.certificates.length,
      soonestLabel: soonest ? formatDate(soonest) : null,
      badge,
    };
  });

  // "Actie nodig" — expiring/expired across everyone.
  const alerts = consultants
    .flatMap((c) =>
      c.certificates.map((ct) => ({
        ...ct,
        consultantName: `${c.firstName} ${c.lastName}`,
        hasEmail: Boolean(c.email?.trim()),
        st: certStatus(ct.expiryDate, now),
      })),
    )
    .filter((x) => x.st === "expiring" || x.st === "expired")
    .sort((a, b) => {
      const d = ORDER[a.st] - ORDER[b.st];
      if (d !== 0) return d;
      return (a.expiryDate?.getTime() ?? 0) - (b.expiryDate?.getTime() ?? 0);
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
                    <TR key={a.id}>
                      <TD className="font-medium text-slate-900">{a.consultantName}</TD>
                      <TD>{a.name}</TD>
                      <TD>{formatDate(a.expiryDate)}</TD>
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
                          {a.hasEmail ? (
                            <form action={sendCertificateReminder}>
                              <input type="hidden" name="id" value={a.id} />
                              <SubmitButton size="sm" variant="outline" pendingLabel="Sturen…">
                                <Mail className="h-4 w-4" /> Herinnering
                              </SubmitButton>
                            </form>
                          ) : (
                            <span className="text-xs text-amber-600">geen e-mail</span>
                          )}
                          <Link
                            href={`/certificeringen/${a.consultantId}`}
                            className={buttonVariants({ variant: "ghost", size: "sm" })}
                          >
                            Open map
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
