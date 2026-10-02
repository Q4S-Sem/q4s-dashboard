import { redirect } from "next/navigation";

/** Oude plek (Vormgeving & blanco) — staat nu onder Contracten → Blanco / Timesheet. */
export default async function OudeContractTemplate({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string; taal?: string }>;
}) {
  const { doc, taal } = await searchParams;
  const q = new URLSearchParams();
  if (doc) q.set("doc", doc);
  if (taal === "en") q.set("taal", "en");
  redirect(`/contracten/nieuw${q.size ? `?${q}` : ""}`);
}
