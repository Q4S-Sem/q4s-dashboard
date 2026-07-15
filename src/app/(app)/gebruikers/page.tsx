import Link from "next/link";
import { UserCog, Plus, ShieldCheck, KeyRound, Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { APP_USER_ROLES } from "@/lib/domain";
import { deleteUser } from "./actions";

export const metadata = { title: "Gebruikers" };

export default async function GebruikersPage() {
  const users = await db.appUser.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  const total = users.length;
  const admins = users.filter((u) => u.role === "ADMIN").length;
  const withoutPw = users.filter((u) => !u.passwordHash).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gebruikers"
        description="Beheer wie er kan inloggen op het Q4S-dashboard. Wachtwoorden worden versleuteld (gehasht) opgeslagen."
        actions={
          <Link href="/gebruikers/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuwe gebruiker
          </Link>
        }
      />

      {total > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Gebruikers" value={total} icon={<UserCog className="h-5 w-5" />} accent="brand" />
          <StatCard label="Beheerders" value={admins} icon={<ShieldCheck className="h-5 w-5" />} accent="violet" />
          <StatCard
            label="Zonder wachtwoord"
            value={withoutPw}
            icon={<KeyRound className="h-5 w-5" />}
            accent={withoutPw > 0 ? "amber" : "slate"}
          />
        </div>
      )}

      {total === 0 ? (
        <EmptyState
          icon={<UserCog className="h-6 w-6" />}
          title="Nog geen gebruikers"
          description="Voeg de medewerkers toe die met dit dashboard werken en stel hun inloggegevens in."
          action={
            <Link href="/gebruikers/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe gebruiker
            </Link>
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Naam</TH>
                <TH>E-mail (inlognaam)</TH>
                <TH>Functie</TH>
                <TH>Rol</TH>
                <TH>Wachtwoord</TH>
                <TH>Status</TH>
                <TH className="text-right">Acties</TH>
              </TR>
            </THead>
            <TBody>
              {users.map((u) => (
                <TR key={u.id}>
                  <TD className="font-medium text-slate-900">{u.name}</TD>
                  <TD>{u.email}</TD>
                  <TD>{u.jobTitle ?? "—"}</TD>
                  <TD>
                    <StatusBadge options={APP_USER_ROLES} value={u.role} />
                  </TD>
                  <TD>
                    {u.passwordHash ? (
                      <Badge color="green">Ingesteld</Badge>
                    ) : (
                      <Badge color="amber">Nog niet</Badge>
                    )}
                  </TD>
                  <TD>
                    {u.active ? (
                      <Badge color="green">Actief</Badge>
                    ) : (
                      <Badge color="slate">Inactief</Badge>
                    )}
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/gebruikers/${u.id}/bewerken`}
                        className={buttonVariants({ variant: "ghost", size: "icon" })}
                        title="Bewerken"
                        aria-label="Gebruiker bewerken"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <ConfirmSubmit
                        action={deleteUser}
                        id={u.id}
                        message={`Gebruiker "${u.name}" verwijderen?`}
                        variant="ghost"
                        size="icon"
                      >
                        <Trash2 className="h-4 w-4" />
                      </ConfirmSubmit>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <p className="text-xs text-slate-400">
        Let op: inloggen en sessies worden in de auth-fase ingeschakeld. Tot die
        tijd is dit het beheer van accounts en (versleutelde) wachtwoorden.
      </p>
    </div>
  );
}
