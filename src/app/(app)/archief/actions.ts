"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { deleteArchiveFiles, type StoredArchiveFile } from "@/lib/archive";

/** Permanently remove an archived item (and its copied files). */
export async function purgeArchivedItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const item = await db.archivedItem.findUnique({ where: { id } });
  if (item?.filesJson) {
    try {
      await deleteArchiveFiles(id, JSON.parse(item.filesJson) as StoredArchiveFile[]);
    } catch {
      // geen files / kapotte json — prima
    }
  }
  // Deleting an ArchivedItem is exempt from the archive hook (see db.ts).
  await db.archivedItem.delete({ where: { id } }).catch(() => {});
  revalidatePath("/archief");
  redirect("/archief");
}
