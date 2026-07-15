/**
 * Register van bekende MSP-/VMS-/inhuurplatformen in de NL-markt. Eén bron voor de
 * "bekende MSP toevoegen"-presets op /connectors/nieuw, zodat het personeel een
 * platform met één klik koppelt in plaats van alles vrij in te typen.
 *
 * De `key` is de stabiele slug die overal als koppel-sleutel dient
 * (webhook `?connector=<key>`, dedupe, per-connector config) — houd 'm gelijk aan
 * de geseede connectors. De echte API-endpoints/credentials komen per platform
 * later; tot die tijd loopt de intake via de webhook en de testlevering.
 */
export type MspProvider = {
  key: string;
  name: string;
  description: string;
  website?: string;
  /** Optionele standaard API-basis-URL (https). */
  apiBaseUrl?: string;
  /** Aanbevolen start-koppeling (Magnit). */
  recommended?: boolean;
};

export const MSP_PROVIDERS: MspProvider[] = [
  {
    key: "magnit",
    name: "Magnit",
    description: "Wereldwijde MSP/VMS voor externe inhuur — de start-koppeling voor Q4S.",
    website: "https://www.magnit.com",
    recommended: true,
  },
  {
    key: "sap-fieldglass",
    name: "SAP Fieldglass",
    description: "VMS voor externe inhuur & diensten, veel gebruikt bij grote NL-opdrachtgevers.",
    website: "https://www.fieldglass.com",
  },
  {
    key: "beeline",
    name: "Beeline",
    description: "Extended-workforce VMS-platform voor contingent labor.",
    website: "https://www.beeline.com",
  },
  {
    key: "netive",
    name: "Nétive VMS",
    description: "Nederlands VMS voor inhuur en detachering.",
    website: "https://www.netive.nl",
  },
  {
    key: "striive",
    name: "Striive",
    description: "Nederlands marktplaats-platform voor opdrachten en inhuur (voorheen Staffing MS).",
    website: "https://www.striive.com",
  },
  {
    key: "headfirst",
    name: "HeadFirst",
    description: "Nederlandse inhuurintermediair (incl. Brainnet/Between).",
    website: "https://www.headfirst.nl",
  },
  {
    key: "inhuurdesk-rijk",
    name: "Inhuurdesk Rijk",
    description: "Inhuurplatform van de Rijksoverheid voor overheidsopdrachten.",
  },
  {
    key: "mercell",
    name: "Mercell",
    description: "Aanbestedings- en inkoopplatform (NL/Noord-Europa).",
    website: "https://www.mercell.com",
  },
  {
    key: "tenderned",
    name: "TenderNed",
    description: "Aanbestedingsplatform van de Nederlandse overheid.",
    website: "https://www.tenderned.nl",
  },
  {
    key: "flexoord",
    name: "FlexOord",
    description: "Nederlands inhuur-/flexplatform.",
  },
];

/** Snelle lookup op key. */
export function mspProvider(key: string): MspProvider | undefined {
  return MSP_PROVIDERS.find((p) => p.key === key);
}
