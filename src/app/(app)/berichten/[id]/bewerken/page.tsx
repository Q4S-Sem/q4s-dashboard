import Link from "next/link";
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
      <Link
        href={`/berichten/${message.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar bericht
      </Link>
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
