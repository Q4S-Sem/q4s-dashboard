import { redirect } from "next/navigation";

// De Recruitment-hub opent direct op de Talentpool i.p.v. een apart
// dashboard: dat is waar je als eerste wilt beginnen. De oude overzichtscijfers
// staan nog op de losse pagina's (Pipeline, Talentpool, Sollicitaties).
export default function RecruitmentPage() {
  redirect("/kandidaten");
}
