import { db } from "./db";
import type { DossierCertificate, DossierPerson } from "./dossier-check";

// Server-side ophaallaag voor de dossiercheck: zet de personeelsdossiers om in de
// platte DossierPerson-vorm die de PURE check in ./dossier-check verwacht. Alleen
// lezen — hier wordt niets aangemaakt, gemaild of gewijzigd.

/** Nieuwste evaluatiedatum; valt terug op het aanmaakmoment als de datum leeg is. */
function latestEvaluationDate(
  evaluations: { evaluationDate: Date | null; createdAt: Date }[],
): Date | null {
  return evaluations.reduce<Date | null>((latest, evaluation) => {
    const date = evaluation.evaluationDate ?? evaluation.createdAt;
    return !latest || date > latest ? date : latest;
  }, null);
}

type EmployeeDoc = { category: string; title: string; expiryDate: Date | null };

/** Een geüpload diploma/certificaat in een medewerkersdossier telt als certificaat. */
function employeeCertificates(documents: EmployeeDoc[]): DossierCertificate[] {
  return documents
    .filter((document) => document.category === "DIPLOMA")
    .map((document) => ({ name: document.title, expiryDate: document.expiryDate }));
}

/**
 * Haal per ACTIEVE gedetacheerde (Consultant) en per ACTIEVE eigen medewerker
 * (Employee) de dossiergegevens op. Is een gedetacheerde gekoppeld aan eigen
 * personeel (Consultant.employeeId), dan telt hij één keer mee — als gedetacheerde,
 * met de stukken uit BEIDE dossiers, zodat een document dat bij Medewerkers staat
 * niet onterecht als ontbrekend verschijnt.
 */
export async function loadDossierPeople(): Promise<DossierPerson[]> {
  const [consultants, employees] = await Promise.all([
    db.consultant.findMany({
      where: { active: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employmentType: true,
        documents: { select: { category: true } },
        certificates: { select: { name: true, expiryDate: true } },
        contracts: { select: { id: true }, take: 1 },
        evaluations: { select: { evaluationDate: true, createdAt: true } },
        employee: {
          select: { documents: { select: { category: true, title: true, expiryDate: true } } },
        },
      },
    }),
    db.employee.findMany({
      where: { active: true, detachering: { is: null } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employmentType: true,
        documents: { select: { category: true, title: true, expiryDate: true } },
      },
    }),
  ]);

  const consultantPeople: DossierPerson[] = consultants.map((consultant) => {
    const employeeDocs = consultant.employee?.documents ?? [];
    return {
      id: consultant.id,
      kind: "consultant",
      name: `${consultant.firstName} ${consultant.lastName}`.trim(),
      employmentType: consultant.employmentType,
      documentCategories: [
        ...consultant.documents.map((document) => document.category),
        ...employeeDocs.map((document) => document.category),
      ],
      hasContractRecord: consultant.contracts.length > 0,
      certificates: [...consultant.certificates, ...employeeCertificates(employeeDocs)],
      lastEvaluationAt: latestEvaluationDate(consultant.evaluations),
    };
  });

  const employeePeople: DossierPerson[] = employees.map((employee) => ({
    id: employee.id,
    kind: "employee",
    name: `${employee.firstName} ${employee.lastName}`.trim(),
    employmentType: employee.employmentType,
    documentCategories: employee.documents.map((document) => document.category),
    certificates: employeeCertificates(employee.documents),
    lastEvaluationAt: null,
  }));

  return [...consultantPeople, ...employeePeople];
}
