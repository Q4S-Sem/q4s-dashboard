import { NormPage } from "../NormPage";

export const metadata = { title: "ISO 9001" };

export default function Iso9001Page() {
  return (
    <NormPage
      title="ISO 9001"
      description="Kwaliteitsmanagement: laten zien dat we werken volgens vaste processen, klanttevredenheid meten en blijven verbeteren."
      checks={[
        "Klanttevredenheid wordt gemeten (inlener-evaluaties) en opgevolgd",
        "Medewerkers zijn aantoonbaar bekwaam: certificaten geldig en vastgelegd",
        "Elke plaatsing heeft een getekende overeenkomst en vaste werkwijze",
        "Klachten, afwijkingen en verbeteracties worden vastgelegd en afgehandeld",
        "Jaarlijkse interne audit en directiebeoordeling",
      ]}
      links={[
        { href: "/evaluaties/inlener", label: "Inlener-evaluaties", uitleg: "Klanttevredenheid per plaatsing" },
        { href: "/certificeringen", label: "Certificeringen", uitleg: "Geldigheid van certificaten per medewerker" },
        { href: "/contracten", label: "Contracten", uitleg: "Overeenkomsten per plaatsing" },
        { href: "/agenda/taken", label: "Takenlijst", uitleg: "Verbeteracties en opvolging" },
      ]}
    />
  );
}
