import { renderSignatureDocument, signatureFromSettings } from "@/lib/email-signature";
import { emailLogoDataUri } from "@/lib/email";
import { getCompanySettings } from "@/lib/settings";

// Temporary test route to verify signature icons render correctly.
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
  const html = renderSignatureDocument(sig);
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
