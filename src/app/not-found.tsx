import Link from "next/link";

/** Nederlandse 404 i.p.v. de Engelse standaardpagina. */
export default function NietGevonden() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-xl font-semibold text-ink-900">Pagina niet gevonden</h1>
      <p className="text-sm text-ink-500">Deze pagina bestaat niet (meer) of is verplaatst.</p>
      <Link href="/" className="text-sm font-medium text-brand-700 hover:underline">
        Naar de startpagina
      </Link>
    </div>
  );
}
