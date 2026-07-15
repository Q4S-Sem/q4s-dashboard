import { redirect } from "next/navigation";

// Evaluaties is split into two pages per form type — land on the VCU overview.
export default function EvaluatiesIndex() {
  redirect("/evaluaties/vcu");
}
