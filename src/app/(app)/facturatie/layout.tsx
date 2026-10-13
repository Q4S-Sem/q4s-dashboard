// Alle facturatie-pagina's: tabelkolommen gecentreerd (zie .facturatie-midden in globals.css).
export default function FacturatieLayout({ children }: { children: React.ReactNode }) {
  return <div className="facturatie-midden">{children}</div>;
}
