import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getNavBadges } from "@/lib/facturatie";
import { getNotifications } from "@/lib/notifications";
import { getLogoSrc } from "@/lib/branding";
import { currentUser, authRequired } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  // Inloggen is (voorlopig) optioneel: alleen afdwingen als AUTH_REQUIRED aan staat.
  if (!user && authRequired()) redirect("/login");

  const [badges, notifications] = await Promise.all([getNavBadges(), getNotifications()]);
  const logoSrc = getLogoSrc();
  return (
    <AppShell badges={badges} notifications={notifications} logoSrc={logoSrc} user={user}>
      {children}
    </AppShell>
  );
}
