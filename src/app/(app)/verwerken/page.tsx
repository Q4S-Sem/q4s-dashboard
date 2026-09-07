import { redirect } from "next/navigation";

// De oude facturatie-hub is vervangen door de begeleide wizard "Week verwerken"
// (/verwerken/nieuw) + de opgeschoonde sidebar. Deze route stuurt door zodat oude
// links/bookmarks blijven werken, zonder de verwarrende hub (met verouderde
// "inkoopfactuur"-taal uit vóór Optie A) nog te tonen.
export const dynamic = "force-dynamic";

export default function VerwerkenIndex() {
  redirect("/verwerken/nieuw");
}
