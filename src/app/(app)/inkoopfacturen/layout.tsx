import { redirect } from "next/navigation";

/** Legacy self-billing URLs gaan naar de echte freelancerfacturen. */
export default function InkoopfacturenLegacyLayout({
  children: _children,
}: Readonly<{ children: React.ReactNode }>) {
  redirect("/ontvangen-facturen");
}
