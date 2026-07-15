import Link from "next/link";
import { MessageSquare, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { OUTREACH_CHANNELS, OUTREACH_STATUSES } from "@/lib/domain";

export const metadata = { title: "Outreach" };

export default async function BerichtenPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const messages = await db.outreachMessage.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outreach"
        description="AI stelt gepersonaliseerde berichten op; jij keurt goed en verstuurt zelf."
        actions={
          <Link href="/berichten/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuw bericht
          </Link>
        }
      />

      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Dit bericht kon niet verwijderd worden.
        </p>
      )}

      {messages.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-6 w-6" />}
          title="Nog geen berichten"
          description="Maak een nieuw bericht aan en laat de AI een gepersonaliseerd concept opstellen."
          action={
            <Link href="/berichten/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuw bericht
            </Link>
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Ontvanger</TH>
                <TH>Bedrijf</TH>
                <TH>Kanaal</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {messages.map((m) => (
                <TR key={m.id}>
                  <TD>
                    <Link
                      href={`/berichten/${m.id}`}
                      className="font-medium text-slate-900 hover:text-brand-700"
                    >
                      {m.recipientName}
                    </Link>
                  </TD>
                  <TD>{m.company ?? "—"}</TD>
                  <TD>
                    <StatusBadge options={OUTREACH_CHANNELS} value={m.channel} />
                  </TD>
                  <TD>
                    <StatusBadge options={OUTREACH_STATUSES} value={m.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
