import { redirect } from "next/navigation";

// De timesheet staat nu als blanco document onder Blanco.
export default async function TimesheetPage({ searchParams }: { searchParams: Promise<{ taal?: string }> }) {
  const taal = (await searchParams).taal === "en" ? "&taal=en" : "";
  redirect(`/contracten/blanco?doc=timesheet${taal}`);
}
