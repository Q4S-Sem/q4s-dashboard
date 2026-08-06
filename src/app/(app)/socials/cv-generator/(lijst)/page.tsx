import Link from "next/link";
import { EyeOff, FileDown, FileUser, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { UploadCvForm } from "../UploadCvForm";
import { startCvProfile } from "../actions";

export const metadata = { title: "CV-generator" };

export default async function CvGeneratorPage() {
  const profiles = await db.cvProfile.findMany({
    include: { candidate: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-ink-400" /> Nieuw Q4S-CV
          </CardTitle>
          <span className="text-sm text-ink-400">
            Upload het CV zoals je het kreeg. De AI leest het uit, jij kijkt het na, en daarna
            rolt het Q4S-CV eruit als PDF en Word.
          </span>
        </CardHeader>
        <CardContent>
          <UploadCvForm action={startCvProfile} />
          <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-500">
            <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
            CV&apos;s worden standaard geanonimiseerd: achternaam wordt een initiaal en Q4S staat
            als enige contact op het CV. Per CV uit te zetten in het volgende scherm.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gemaakte Q4S-CV&apos;s</CardTitle>
        </CardHeader>
        {profiles.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={<FileUser className="h-6 w-6" />}
              title="Nog geen Q4S-CV's"
              description="Upload hierboven een CV, of pak er een uit het mapje Kandidaten."
            />
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Naam</TH>
                <TH>Functietitel</TH>
                <TH>Kandidaat</TH>
                <TH>Anoniem</TH>
                <TH>Bijgewerkt</TH>
                <TH>Download</TH>
              </TR>
            </THead>
            <TBody>
              {profiles.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link
                      href={`/socials/cv-generator/${p.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {p.fullName}
                    </Link>
                  </TD>
                  <TD>{p.headline ?? "—"}</TD>
                  <TD>
                    {p.candidate ? (
                      <Link
                        href={`/kandidaten/${p.candidate.id}`}
                        className="text-ink-600 hover:text-brand-700"
                      >
                        {p.candidate.firstName} {p.candidate.lastName}
                      </Link>
                    ) : (
                      <span className="text-ink-400">Los CV</span>
                    )}
                  </TD>
                  <TD>
                    {p.anonymize ? (
                      <span className="inline-flex items-center gap-1.5 text-ink-600">
                        <EyeOff className="h-3.5 w-3.5 text-ink-400" /> Ja
                      </span>
                    ) : (
                      <span className="text-amber-700">Nee</span>
                    )}
                  </TD>
                  <TD>{formatDate(p.updatedAt)}</TD>
                  <TD>
                    <div className="flex gap-1.5">
                      <a
                        href={`/socials/cv-generator/${p.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                      >
                        <FileDown className="h-3.5 w-3.5" /> PDF
                      </a>
                      <a
                        href={`/socials/cv-generator/${p.id}/docx`}
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                      >
                        <FileDown className="h-3.5 w-3.5" /> Word
                      </a>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
