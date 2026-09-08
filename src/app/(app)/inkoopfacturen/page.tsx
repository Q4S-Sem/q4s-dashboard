import { redirect } from "next/navigation";

export const metadata = { title: "Ontvangen facturen" };

export default function InkoopfacturenLegacyPage() {
  redirect("/ontvangen-facturen");
}