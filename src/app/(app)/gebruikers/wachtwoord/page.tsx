import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";

/**
 * "Mijn wachtwoord" is verhuisd naar je eigen gebruikerspagina — daar staat
 * alles over je account bij elkaar. Deze route blijft bestaan zodat oude
 * links, bladwijzers en het menu niet ineens doodlopen.
 */
export default async function WachtwoordRedirect() {
  const user = await currentUser();
  redirect(user ? `/gebruikers/${user.id}/bewerken` : "/login");
}
