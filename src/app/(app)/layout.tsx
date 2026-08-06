import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FormAutosave } from "@/components/form-autosave";
import { OfflineGuard } from "@/components/offline-guard";
import { NavHistory } from "@/components/nav-history";
import { UnsavedGuard } from "@/components/unsaved-guard";
import { getNavBadges } from "@/lib/facturatie";
import { getNotifications } from "@/lib/notifications";
import { currentUser, authRequired } from "@/lib/session";
import { ensureAiKeysLoaded } from "@/lib/ai-keys";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  // Inloggen is (voorlopig) optioneel: alleen afdwingen als AUTH_REQUIRED aan staat.
  if (!user && authRequired()) redirect("/login");

  // Hydrateer de in het dashboard opgeslagen AI-sleutels uit de DB in process.env
  // vóór de pagina rendert. Serverless-instances die bij een cold start de sleutels
  // nog niet hadden (of warm zijn van vóór het invoeren), zouden anders bij elke
  // render "AI niet geconfigureerd" tonen — de tip "stel API-sleutels in" bleef zo
  // hangen terwijl ze al ingevoerd waren. 60s-cache, dus goedkoop.
  const [badges, notifications] = await Promise.all([
    getNavBadges(),
    getNotifications(),
    ensureAiKeysLoaded(),
  ]);
  return (
    <>
      <FormAutosave />
      <OfflineGuard />
      <NavHistory />
      <UnsavedGuard />
      <AppShell badges={badges} notifications={notifications} user={user}>
        {children}
      </AppShell>
    </>
  );
}
