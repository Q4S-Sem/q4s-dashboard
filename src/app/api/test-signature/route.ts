import { renderSignatureDocument, signatureFromSettings } from "@/lib/email-signature";
import { emailLogoDataUri, defaultBadgeDataUris } from "@/lib/email";
import { getCompanySettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getCompanySettings();
  const logoSrc = emailLogoDataUri() ?? "";
  const sig = signatureFromSettings(settings, logoSrc, {
    name: "Gjil de Jong",
    jobTitle: "Talent & Business Consultant",
    phone: "+31 6 83859566",
    email: "gjil.dejong@q4s.nl",
  });

  // Same logic as the real signature page: use custom badges if any,
  // otherwise fall back to the default embedded set (DNV/VCU/SNA).
  const customBadges = sig.badges;
  sig.badges = customBadges.length ? customBadges : defaultBadgeDataUris();

  const html = renderSignatureDocument(sig);
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
