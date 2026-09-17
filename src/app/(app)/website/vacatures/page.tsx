import { redirect } from "next/navigation";

/**
 * De losse "Vacatures — Website"-tabel is eruit gehaald: die dubbelde met de
 * vacatures in de recruitment-hub en was nergens vanuit het menu bereikbaar.
 * Deze route redirect nu naar de echte vacaturepagina in de recruitment-hub,
 * zodat oude links (en het CV-matches-scherm) op de juiste plek uitkomen.
 *
 * De subroute /website/vacatures/[id]/sollicitaties blijft wél bestaan — die
 * wordt gebruikt vanaf het website-overzicht.
 */
export default function WebsiteVacaturesPage() {
  redirect("/crm/vacatures");
}
