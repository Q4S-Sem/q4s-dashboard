import { redirect } from "next/navigation";

/**
 * De losse CV-overzicht/hub-pagina is eruit gehaald. Deze route blijft bestaan
 * als redirect naar de inbox, zodat oude links en bookmarks niet op een 404
 * belanden — de CV's-groep in het menu wijst nu rechtstreeks naar de inbox.
 */
export default function CvIndexPage() {
  redirect("/website/cv-inbox");
}
