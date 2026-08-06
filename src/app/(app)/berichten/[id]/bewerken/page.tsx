import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { OutreachForm } from "../../OutreachForm";
import { updateOutreach } from "../../actions";

export const metadata = { title: "Bericht bewerken" };

export default async function BerichtBewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [message, vacancies] = await Promise.all([
    db.outreachMessage.findUnique({ where: { id } }),
    db.vacancy.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);
  if (!message) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href={`/berichten/${message.id}`}>
        Terug naar bericht
      </BackLink>
      <PageHeader title="Bericht bewerken" description={message.recipientName} />
      <OutreachForm
        action={updateOutreach}
        message={message}
        vacancies={vacancies}
        submitLabel="Wijzigingen opslaan"
        cancelHref={`/berichten/${message.id}`}
      />
    </div>
  );
}
