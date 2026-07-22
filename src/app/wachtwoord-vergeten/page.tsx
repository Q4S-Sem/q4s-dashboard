import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "./ForgotForm";

export const metadata = { title: "Wachtwoord vergeten — Q4S" };
export const dynamic = "force-dynamic";

export default async function ForgotPage() {
  if (await currentUser()) redirect("/");

  return (
    <AuthShell
      title="Wachtwoord vergeten"
      subtitle="Vul je e-mailadres in — we sturen je een link om een nieuw wachtwoord te kiezen."
    >
      <ForgotForm />
    </AuthShell>
  );
}
