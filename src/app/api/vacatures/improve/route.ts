import { isAIConfigured } from "@/lib/ai";
import { aiImproveVacancyFields } from "@/lib/recruitment";
import { requireApiSession } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * Live "Verbeter met AI" for the vacancy form: takes the raw text + context,
 * returns the structured website sections so the form can fill them in for
 * review BEFORE saving. No DB write happens here.
 */
export async function POST(req: Request) {
  const gate = await requireApiSession();
  if (gate) return gate;

  if (!isAIConfigured()) {
    return Response.json({ error: "AI is niet ingesteld." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.rawText !== "string" || !body.rawText.trim()) {
    return Response.json(
      { error: "Plak eerst de binnengekomen vacaturetekst." },
      { status: 400 },
    );
  }

  try {
    const result = await aiImproveVacancyFields({
      title: String(body.title ?? ""),
      discipline: body.discipline ? String(body.discipline) : null,
      location: body.location ? String(body.location) : null,
      employmentType: body.employmentType ? String(body.employmentType) : null,
      salary: body.salary ? String(body.salary) : null,
      company: body.companyName ? String(body.companyName) : null,
      rawText: body.rawText,
    });
    return Response.json(result);
  } catch {
    return Response.json(
      { error: "AI-verbetering mislukt. Probeer het opnieuw." },
      { status: 500 },
    );
  }
}
