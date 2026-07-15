"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { TARGET_STATUS_VALUES, APPLICATION_STATUS_VALUES } from "@/lib/domain";
import { createSuccessPostForPlacement } from "@/lib/socials";
import { currentRecruiterId, logNote } from "@/lib/crm";

/** Sleep een deal naar een andere fase; werkt status/kans bij en logt de wissel. */
export async function moveDeal(id: string, toStageId: string) {
  if (!id || !toStageId) return;
  const [deal, stage] = await Promise.all([
    db.deal.findUnique({ where: { id }, include: { stage: true } }),
    db.crmStage.findUnique({ where: { id: toStageId } }),
  ]);
  if (!deal || !stage || deal.stageId === toStageId) return;

  const status = stage.isWon ? "WON" : stage.isLost ? "LOST" : "OPEN";
  const recruiterId = await currentRecruiterId();

  await db.deal.update({
    where: { id },
    data: {
      stageId: toStageId,
      status,
      probability: stage.probability,
      closedAt: status === "OPEN" ? null : (deal.closedAt ?? new Date()),
    },
  });

  await logNote({
    type: "STAGE_CHANGE",
    dealId: id,
    authorId: recruiterId,
    body: `Fase gewijzigd: ${deal.stage.name} → ${stage.name}`,
  });

  revalidatePath("/crm");
  revalidatePath("/crm/inzichten");
  revalidatePath(`/crm/deals/${id}`);
}


// --- The two reference boards (sales targets + candidate applications) ---

/** Sleep een opdrachtgever naar een andere fase op het CRM-bord. */
export async function moveTargetClient(id: string, status: string) {
  if (!id || !TARGET_STATUS_VALUES.includes(status)) return;
  await db.targetClient.update({ where: { id }, data: { status } });
  revalidatePath("/crm");
  revalidatePath("/opdrachtgevers");
}

/** Sleep een sollicitatie naar een andere fase op het CRM-bord. */
export async function moveApplication(id: string, status: string) {
  if (!id || !APPLICATION_STATUS_VALUES.includes(status)) return;

  const prev = await db.application.findUnique({ where: { id }, select: { status: true } });
  await db.application.update({ where: { id }, data: { status } });

  // Zelfde proof-loop als op de sollicitatiepagina: een verse plaatsing maakt
  // (best-effort) een anonieme succes-post. Alleen bij de overgang naar PLACED.
  if (status === "PLACED" && prev?.status !== "PLACED") {
    await createSuccessPostForPlacement(id);
    revalidatePath("/posts");
    revalidatePath("/socials");
  }

  revalidatePath("/crm");
  revalidatePath("/sollicitaties");
}
