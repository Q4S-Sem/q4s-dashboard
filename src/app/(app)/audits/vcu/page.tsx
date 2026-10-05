import { NormPage } from "../NormPage";

export const metadata = { title: "VCU" };

export default function VcuPage() {
  return (
    <NormPage
      title="VCU"
      description="Veiligheid, gezondheid en milieu bij uitzenden en detacheren: veilig plaatsen, VCA-bevoegd personeel en evalueren op de werkplek."
      checks={[
        "Iedere uitgezonden kracht heeft een geldig VCA-diploma",
        "VG-evaluatie per plaatsing is uitgevoerd en vastgelegd",
        "Werkplekinformatie en risico's zijn vóór de start met de inlener besproken",
        "Ongevallen en incidenten worden gemeld en geanalyseerd",
        "Personeelsdossiers zijn compleet (zie ook NEN 4400-1)",
      ]}
      links={[
        { href: "/evaluaties/vcu", label: "VG-evaluaties", uitleg: "Veiligheidsevaluaties per plaatsing" },
        { href: "/certificeringen", label: "Certificeringen", uitleg: "VCA en overige certificaten met vervaldatum" },
        { href: "/audits/nen-4400", label: "Dossiercheck", uitleg: "Welke dossierstukken ontbreken of verlopen" },
        { href: "/plaatsingen", label: "Plaatsingen", uitleg: "Lopende plaatsingen per inlener" },
      ]}
    />
  );
}
