import { redirect } from "next/navigation";

// De losse VMS-connectorlijst is weg: koppelingen beheer je in MSP › Koppelingen.
export default function ConnectorsPage() {
  redirect("/vacaturehub/koppelingen");
}
