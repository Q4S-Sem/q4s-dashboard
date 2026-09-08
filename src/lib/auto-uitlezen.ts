export type UploadBestandMeta = {
  name: string;
  size: number;
  lastModified: number;
};

/**
 * Geeft alleen een sleutel terug wanneer precies één nieuw bestand automatisch
 * mag worden uitgelezen. De UI bewaart deze sleutel zodra zij het formulier
 * indient, zodat een dubbele change/drop-event niet twee AI-runs start.
 */
export function autoUitleesSleutel(
  files: readonly UploadBestandMeta[],
  status: { bezig: boolean; laatstGestart: string | null },
): string | null {
  if (status.bezig || files.length !== 1) return null;

  const file = files[0];
  const sleutel = `${file.name}:${file.size}:${file.lastModified}`;
  return sleutel === status.laatstGestart ? null : sleutel;
}
