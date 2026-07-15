"use server";

import { aiText, isAIConfigured } from "@/lib/ai";
import { currentRecruiterId, getCrmSettings, getInsights } from "@/lib/crm";
import { formatCurrency } from "@/lib/utils";

const SYSTEM = `Je bent een nuchtere senior sales- en recruitmentcoach bij Q4S, een Nederlands technisch detacheringsbureau. Je analyseert de CRM-cijfers van (een) recruiter(s) en benoemt scherp waar het proces lekt en wat er concreet beter moet.

Schrijf in helder, zakelijk Nederlands. Gebruik korte kopjes en bondige bullets (met streepjes, GEEN markdown-sterren). Structuur:
1. Korte samenvatting (1-2 zinnen).
2. "Grootste zwakke punten" — max 3, elk met waarom het erg is.
3. "Wat nu te doen" — 3-5 concrete, uitvoerbare acties.
Verzin geen cijfers die er niet zijn; baseer je alleen op de aangeleverde data.`;

/** Laat de AI de pipeline-cijfers duiden: waar liggen de zwakke punten? */
export async function generateWeakPointsAnalysis(
  scope: "mine" | "all",
): Promise<{ text?: string; error?: string }> {
  if (!isAIConfigured()) {
    return { error: "AI is niet geconfigureerd. Zet ANTHROPIC_API_KEY in je .env (of gebruik AI_PROVIDER=ollama)." };
  }

  const recruiterId = await currentRecruiterId();
  const settings = await getCrmSettings(recruiterId);
  const s: "mine" | "all" = scope === "all" ? "all" : "mine";
  const ins = await getInsights({ recruiterId, scope: s, staleAfterDays: settings.staleAfterDays });

  const funnelText = ins.funnel
    .map((f) => `- ${f.name}: ${f.count} open (waarvan ${f.stalled} vastgelopen), gem. ${f.avgAgeDays} dagen oud, waarde ${formatCurrency(f.value)}`)
    .join("\n");
  const lostText = ins.lostReasons.length
    ? ins.lostReasons.map((r) => `- ${r.reason}: ${r.count}×`).join("\n")
    : "- (geen verloren deals geregistreerd)";

  const prompt = `Scope: ${s === "mine" ? "deze recruiter" : "het hele team"}.

Kerncijfers:
- Open deals: ${ins.totalOpen} (totale waarde ${formatCurrency(ins.totalOpenValue)}, gewogen ${formatCurrency(ins.weightedValue)})
- Gewonnen: ${ins.wonCount} · Verloren: ${ins.lostCount} · Winkans: ${ins.winRate ?? "n.v.t."}%
- Gemiddelde leeftijd open deal: ${ins.avgDealAgeDays} dagen
- Vastgelopen deals (geen activiteit > ${settings.staleAfterDays} dagen): ${ins.staleCount}
- Opvolgingen over tijd / vandaag: ${ins.overdueFollowUps}
- Open deals zonder één notitie: ${ins.noContactCount}
- Grootste uitval tussen fases: ${ins.biggestDrop ? `${ins.biggestDrop.fromName} → ${ins.biggestDrop.toName} (${ins.biggestDrop.dropPct}%)` : "geen duidelijke"}
- Relatiegevoel (90d): ${ins.sentiment.positive} positief / ${ins.sentiment.neutral} neutraal / ${ins.sentiment.negative} negatief

Pipeline per fase:
${funnelText}

Verliesredenen:
${lostText}

Analyseer dit en geef je advies.`;

  try {
    const text = await aiText({ system: SYSTEM, prompt, maxTokens: 1000, effort: "medium" });
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Er ging iets mis bij de AI-analyse." };
  }
}
