import { redirect } from "next/navigation";

/** Het voorbeeld is nu de echte PDF (netjes per A4); oude printlinks landen daar. */
export default async function CvPrintRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/socials/cv-generator/${id}/pdf`);
}
