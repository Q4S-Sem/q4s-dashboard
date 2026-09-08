import { redirect } from "next/navigation";

/** De oude self-billingwizard is vervangen door Week verwerken. */
export default function LegacyConsultantFlowLayout({
  children: _children,
}: Readonly<{ children: React.ReactNode }>) {
  redirect("/verwerken/nieuw");
}
