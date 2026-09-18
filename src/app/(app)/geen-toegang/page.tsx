import { LogOut, ShieldAlert } from "lucide-react";
import { logout } from "@/app/login/actions";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Geen toegang" };

/**
 * Vangnet voor een gebruiker aan wie (nog) geen enkele werkplek is toegewezen.
 * De route-guard stuurt hierheen als er niets is om te tonen.
 */
export default function GeenToegangPage() {
  return (
    <div className="mx-auto max-w-lg pt-10">
      <Card>
        <CardContent>
          <EmptyState
            icon={<ShieldAlert className="h-6 w-6" />}
            title="Nog geen toegang"
            description="Je account heeft nog geen werkplekken toegewezen gekregen. Vraag een beheerder om je de juiste toegang te geven."
            action={
              <form action={logout}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-sm bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800"
                >
                  <LogOut className="h-4 w-4" /> Uitloggen
                </button>
              </form>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
