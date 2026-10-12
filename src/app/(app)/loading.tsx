import { PageSkeleton } from "@/components/ui/page-skeleton";

/** Standaard laadscherm voor elke pagina zonder eigen loading.tsx (facturatie,
 *  contracten, CV's …): direct beeld i.p.v. een "bevroren" klik. */
export default function Loading() {
  return <PageSkeleton blocks={3} />;
}
