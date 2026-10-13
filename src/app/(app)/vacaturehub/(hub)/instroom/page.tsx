import { redirect } from "next/navigation";

// Bronnen = MSP › koppelingen (per bron: portaal, eigen API-sleutel, ophalen).
// De instroom per bron blijft op /vacaturehub/instroom/[key].
export default function InstroomPage() {
  redirect("/vacaturehub/koppelingen");
}
