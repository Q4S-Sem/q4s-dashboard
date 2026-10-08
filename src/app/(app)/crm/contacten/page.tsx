import { redirect } from "next/navigation";

// Contacten is samengevoegd met Klanten: één pagina "Klanten & contacten".
export default function ContactenPage() {
  redirect("/opdrachtgevers?tab=contacten");
}
