import { timingSafeEqual } from "node:crypto";

type JobSecrets = {
  cronSecret?: string;
  jobSecret?: string;
};

function secretEquals(candidate: string | null, secret: string | undefined): boolean {
  if (!candidate || !secret) return false;
  const left = Buffer.from(candidate);
  const right = Buffer.from(secret);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Authenticate a provider webhook exclusively with its dedicated request header. */
export function isWebhookRequestAuthorized(
  req: Request,
  secret: string | undefined,
  headerName: string,
): boolean {
  return secretEquals(req.headers.get(headerName), secret);
}

/**
 * Vercel Cron uses Authorization: Bearer <CRON_SECRET>. Other schedulers may use
 * x-job-token with JOB_SECRET. URL query parameters are intentionally ignored:
 * they leak through logs, browser history, analytics, and referrer headers.
 */
export function isJobRequestAuthorized(req: Request, secrets: JobSecrets): boolean {
  return (
    secretEquals(req.headers.get("authorization"), secrets.cronSecret ? `Bearer ${secrets.cronSecret}` : undefined) ||
    secretEquals(req.headers.get("x-job-token"), secrets.jobSecret)
  );
}
