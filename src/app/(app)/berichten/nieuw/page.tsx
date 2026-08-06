import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { OutreachForm } from "../OutreachForm";
import { createOutreach } from "../actions";

export const metadata = { title: "Nieuw bericht" };

export default async function NieuwBerichtPage() {
  const vacancies = await db.vacancy.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href="/berichten">
        Terug naar outreach
      </BackLink>
      <PageHeader
        title="Nieuw bericht"
        description="Leg de ontvanger en de aanleiding vast; de AI schrijft daarna een concept."
      />
      <OutreachForm
        action={createOutreach}
        vacancies={vacancies}
        submitLabel="Bericht opslaan"
        cancelHref="/berichten"
      />
    </div>
  );
}
