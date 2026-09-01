import assert from "node:assert/strict";
import test from "node:test";
import { buildCvIntakeShortlistPlan } from "../src/lib/cv-intake";

test("a new CV produces one explainable recruiter-review shortlist without any outbound or pipeline action", () => {
  const plan = buildCvIntakeShortlistPlan({
    candidateId: "candidate-1",
    candidateName: "Sam Lasser",
    cvFileName: "sam-lasser.pdf",
    needsProfileExtraction: true,
    matches: [
      {
        vacancyId: "vacancy-1",
        vacancyTitle: "Pijplasser 6G",
        score: 0.8,
        reason: "zelfde discipline (LASSEN), 1 overeenkomend(e) trefwoord(en)",
      },
    ],
    alreadyAlertedForCv: false,
  });

  assert.equal(plan.status, "PENDING_REVIEW");
  assert.equal(plan.shouldExtractProfile, true);
  assert.equal(plan.shouldCreateAlert, true);
  assert.match(plan.alert.body, /80%/);
  assert.match(plan.alert.body, /zelfde discipline/);
  assert.match(plan.alert.body, /Nakijken/);
  assert.deepEqual(plan.automaticActions, []);
});

test("reprocessing the same CV is idempotent and does not create another recruiter alert", () => {
  const plan = buildCvIntakeShortlistPlan({
    candidateId: "candidate-1",
    candidateName: "Sam Lasser",
    cvFileName: "sam-lasser.pdf",
    needsProfileExtraction: false,
    matches: [],
    alreadyAlertedForCv: true,
  });

  assert.equal(plan.status, "PENDING_REVIEW");
  assert.equal(plan.shouldExtractProfile, false);
  assert.equal(plan.shouldCreateAlert, false);
  assert.deepEqual(plan.automaticActions, []);
});
