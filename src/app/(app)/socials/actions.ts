"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { aiText } from "@/lib/ai";

// Public URL of the talentpool landing page. Set NEXT_PUBLIC_SITE_URL in .env to
// emit a full link in the post; otherwise the relative path is used and the
// recruiter finalises the link before publishing.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
const POOL_URL = SITE_URL ? `${SITE_URL}/talentpool` : "/talentpool";

const SYSTEM_TALENTPOOL = `Je bent de social-media manager van Q4S, een Nederlands detacherings- en wervingsbureau gespecialiseerd in technische kwaliteitsdisciplines: QA (Quality Assurance), QC (Quality Control), lassen/welding, fitters, HSE/veiligheid en NDO/NDT (niet-destructief onderzoek).

Je schrijft een pakkende LinkedIn-post die technische vakmensen uitnodigt om lid te worden van de Q4S Talentpool. Doel is NIET één specifieke vacature, maar het opbouwen van een community: vakmensen melden zich aan zodat Q4S hen als eerste benadert bij passende opdrachten bij toonaangevende opdrachtgevers (zoals TenneT, Tata Steel, scheepsbouw en offshore wind).

Strikte regels:
- Vloeiend, natuurlijk Nederlands (je-vorm), energiek maar geloofwaardig. Geen overdreven verkooppraat of clichés.
- LinkedIn-stijl: 3–6 korte regels/alinea's, 1–2 relevante emoji's mogen.
- Begin met een sterke hook gericht op vakmensen (lassers, QC/QA-inspecteurs, NDT'ers, fitters, HSE'ers).
- Benadruk de voordelen: als eerste op de hoogte van passende opdrachten, persoonlijke matching, vrijblijvend.
- Eindig met een duidelijke call-to-action om lid te worden van de Q4S Talentpool, met de aanmeldlink.
- Sluit af met passende hashtags (zoals #techniek #vacature #lassen #NDT #Q4S).
- Geef ALLEEN de posttekst terug, zonder uitleg, zonder aanhalingstekens, zonder labels.`;

/** Create a DRAFT social post that recruits members into the Q4S Talentpool. */
export async function generateTalentpoolPost() {
  const post = await db.socialPost.create({
    data: {
      title: "Word lid van de Q4S Talentpool",
      platform: "LINKEDIN",
      topic:
        "Technische vakmensen werven voor de Q4S Talentpool (community-werving, niet één vacature).",
      hashtags: "#techniek #vacature #Q4S",
      status: "DRAFT",
    },
  });

  let aiFailed = false;
  try {
    const content = await aiText({
      system: SYSTEM_TALENTPOOL,
      prompt: `Schrijf een wervende LinkedIn-post die technische vakmensen uitnodigt om lid te worden van de Q4S Talentpool. Sluit af met een call-to-action om zich aan te melden via deze link: ${POOL_URL}`,
      maxTokens: 1200,
      effort: "medium",
    });
    await db.socialPost.update({ where: { id: post.id }, data: { content } });
  } catch {
    aiFailed = true;
  }

  revalidatePath("/posts");
  revalidatePath("/socials");
  // redirect() stays OUTSIDE the try/catch so its control-flow throw isn't caught.
  redirect(aiFailed ? `/posts/${post.id}?error=ai` : `/posts/${post.id}`);
}

// ---------------------------------------------------------------------------
// Kanalen bijhouden (Socials → Overzicht)
// ---------------------------------------------------------------------------

const volgers = (v: FormDataEntryValue | null) => {
  const n = Math.round(Number(String(v ?? "").replace(/[.\s]/g, "")));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export async function voegKanaalToe(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const url = String(formData.get("url") ?? "").trim().slice(0, 300);
  if (!name) redirect("/socials?fout=kanaal");
  const n = volgers(formData.get("followers"));
  await db.socialChannel.create({
    data: {
      platform: String(formData.get("platform") ?? "OVERIG"),
      name,
      url: url && !/^https?:\/\//i.test(url) ? `https://${url}` : url,
      followers: n,
      prevFollowers: n,
    },
  });
  revalidatePath("/socials");
}

/** Nieuw volgersaantal: het oude wordt bewaard voor de groei. */
export async function werkVolgersBij(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const k = await db.socialChannel.findUnique({ where: { id }, select: { followers: true } });
  if (!k) return;
  await db.socialChannel.update({
    where: { id },
    data: { prevFollowers: k.followers, followers: volgers(formData.get("followers")) },
  });
  revalidatePath("/socials");
}

export async function verwijderKanaal(formData: FormData) {
  await db.socialChannel.delete({ where: { id: String(formData.get("id") ?? "") } }).catch(() => null);
  revalidatePath("/socials");
}
