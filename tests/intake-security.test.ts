import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_UPLOAD_BYTES,
  isMultipartUploadWithinLimit,
  isUploadWithinLimit,
} from "../src/lib/upload-policy";
import { isJobRequestAuthorized, isWebhookRequestAuthorized } from "../src/lib/webhook-auth";

test("upload policy accepts the exact file limit and rejects one byte over", () => {
  assert.equal(isUploadWithinLimit(MAX_UPLOAD_BYTES), true);
  assert.equal(isUploadWithinLimit(MAX_UPLOAD_BYTES + 1), false);
  assert.equal(isUploadWithinLimit(-1), false);
});

test("multipart request policy allows only bounded form overhead", () => {
  assert.equal(isMultipartUploadWithinLimit(MAX_UPLOAD_BYTES), true);
  assert.equal(isMultipartUploadWithinLimit(MAX_UPLOAD_BYTES + 1_000_000), true);
  assert.equal(isMultipartUploadWithinLimit(MAX_UPLOAD_BYTES + 1_000_001), false);
});

test("webhooks accept their dedicated header and never a query-string secret", () => {
  const secret = "webhook-secret";
  assert.equal(
    isWebhookRequestAuthorized(new Request("https://q4s.test/api/inbox/email", { headers: { "x-inbox-token": secret } }), secret, "x-inbox-token"),
    true,
  );
  assert.equal(
    isWebhookRequestAuthorized(new Request(`https://q4s.test/api/inbox/email?token=${secret}`), secret, "x-inbox-token"),
    false,
  );
});

test("jobs preserve Vercel Cron bearer authentication but reject query-string secrets", () => {
  const config = { cronSecret: "vercel-cron-secret", jobSecret: "job-secret" };
  assert.equal(
    isJobRequestAuthorized(new Request("https://q4s.test/api/jobs/daily-sync", { headers: { authorization: "Bearer vercel-cron-secret" } }), config),
    true,
  );
  assert.equal(
    isJobRequestAuthorized(new Request("https://q4s.test/api/jobs/daily-sync", { headers: { "x-job-token": "job-secret" } }), config),
    true,
  );
  assert.equal(
    isJobRequestAuthorized(new Request("https://q4s.test/api/jobs/daily-sync?token=job-secret"), config),
    false,
  );
});
