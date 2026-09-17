import { renderSignatureDocument, signatureFromSettings } from "@/lib/email-signature";
import { emailLogoDataUri, defaultBadgeDataUris } from "@/lib/email";
import { getCompanySettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getCompanySettings();
  const logoSrc = emailLogoDataUri() ?? "";

  // Override badges with defaults if none configured
  const badges = defaultBadgeDataUris();
  const settingsWithBadges = {
    ...settings,
    emailSigBadgesJson: settings.emailSigBadgesJson || JSON.stringify(badges),
  };

  const sig = signatureFromSettings(settingsWithBadges, logoSrc, {
    name: "Gjil de Jong",
    jobTitle: "Talent & Business Consultant",
    phone: "+31 6 83859566",
    email: "gjil.dejong@q4s.nl",
  });
  const html = renderSignatureDocument(sig);
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
