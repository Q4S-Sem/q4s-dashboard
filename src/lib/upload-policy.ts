/** Shared limits for every untrusted file intake path. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_MULTIPART_UPLOAD_OVERHEAD_BYTES = 1_000_000;

/** True only for a finite, non-negative file size within the intake limit. */
export function isUploadWithinLimit(size: number): boolean {
  return Number.isFinite(size) && size >= 0 && size <= MAX_UPLOAD_BYTES;
}

/**
 * Bounds a multipart request before parsing it. The allowance covers form fields
 * and MIME boundaries around one accepted file; file bytes remain capped above.
 */
export function isMultipartUploadWithinLimit(contentLength: number): boolean {
  return (
    Number.isFinite(contentLength) &&
    contentLength >= 0 &&
    contentLength <= MAX_UPLOAD_BYTES + MAX_MULTIPART_UPLOAD_OVERHEAD_BYTES
  );
}

/** Throw at the storage boundary so callers cannot accidentally bypass the cap. */
export function assertUploadWithinLimit(size: number): void {
  if (!isUploadWithinLimit(size)) throw new RangeError("Bestand overschrijdt de uploadlimiet.");
}
