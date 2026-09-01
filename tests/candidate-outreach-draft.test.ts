import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCandidateOutreachDraft,
  canRegenerateOutreach,
  canReopenOutreach,
  canTransitionOutreach,
  createCandidateOutreachDraft,
} from "../src/lib/candidate-outreach-draft";

test("a recruiter-triggered candidate vacancy context creates one personalized draft that remains human-approved", () => {
  const draft = buildCandidateOutreachDraft({
    candidate: {
      id: "candidate-1",
      firstName: "Sam",
      lastName: "Lasser",
      headline: "Gecertificeerd pijplasser",
      discipline: "LASSEN",
    },
    vacancy: {
      id: "vacancy-1",
      title: "Pijplasser 6G",
      discipline: "LASSEN",
      location: "Rotterdam",
    },
    contextKey: "vacancy-match:v1",
    recruiterContext: "Match na handmatige review van het CV.",
  });

  assert.equal(draft.candidateId, "candidate-1");
  assert.equal(draft.vacancyId, "vacancy-1");
  assert.equal(draft.contextKey, "vacancy-match:v1");
  assert.equal(draft.status, "DRAFT");
  assert.equal(draft.channel, "LINKEDIN");
  assert.equal(draft.sentAt, null);
  assert.match(draft.context, /handmatige review/);
  assert.match(draft.context, /Pijplasser 6G/);
  assert.match(draft.draft, /Sam/);
  assert.match(draft.draft, /Pijplasser 6G/);
  assert.deepEqual(draft.automaticActions, []);
});

test("the same candidate vacancy context has a stable idempotency key without approving or sending", () => {
  const input = {
    candidate: {
      id: "candidate-1",
      firstName: "Sam",
      lastName: "Lasser",
      headline: null,
      discipline: "LASSEN",
    },
    vacancy: {
      id: "vacancy-1",
      title: "Pijplasser 6G",
      discipline: "LASSEN",
      location: null,
    },
    contextKey: "vacancy-match:v1",
    recruiterContext: "",
  };

  const first = buildCandidateOutreachDraft(input);
  const repeated = buildCandidateOutreachDraft(input);

  assert.equal(first.idempotencyKey, "candidate-1:vacancy-1:vacancy-match:v1");
  assert.equal(repeated.idempotencyKey, first.idempotencyKey);
  assert.equal(repeated.status, "DRAFT");
  assert.equal(repeated.sentAt, null);
});

test("creating the same recruiter-triggered candidate draft twice returns the original draft", async () => {
  const created: { id: string; candidateId: string; vacancyId: string; contextKey: string; status: string; sentAt: null }[] = [];
  const repository = {
    async findExisting(input: { candidateId: string; vacancyId: string; contextKey: string }) {
      return created.find(
        (row) =>
          row.candidateId === input.candidateId &&
          row.vacancyId === input.vacancyId &&
          row.contextKey === input.contextKey,
      ) ?? null;
    },
    async create(input: { candidateId: string; vacancyId: string; contextKey: string; status: string; sentAt: null }) {
      const row = { id: `outreach-${created.length + 1}`, ...input };
      created.push(row);
      return row;
    },
  };
  const input = {
    candidate: { id: "candidate-1", firstName: "Sam", lastName: "Lasser", headline: null, discipline: "LASSEN" },
    vacancy: { id: "vacancy-1", title: "Pijplasser 6G", discipline: "LASSEN", location: null },
    contextKey: "vacancy-match:v1",
    recruiterContext: "Handmatig geselecteerd.",
  };

  const first = await createCandidateOutreachDraft(repository, input);
  const repeated = await createCandidateOutreachDraft(repository, input);

  assert.equal(first.created, true);
  assert.equal(repeated.created, false);
  assert.equal(first.message.id, repeated.message.id);
  assert.equal(created.length, 1);
  assert.equal(first.message.status, "DRAFT");
  assert.equal(first.message.sentAt, null);
});

test("outreach can only move from a non-empty DRAFT to APPROVED and then SENT", () => {
  assert.equal(canTransitionOutreach({ status: "DRAFT", draft: "Persoonlijk concept", target: "APPROVED" }), true);
  assert.equal(canTransitionOutreach({ status: "DRAFT", draft: null, target: "APPROVED" }), false);
  assert.equal(canTransitionOutreach({ status: "DRAFT", draft: "Persoonlijk concept", target: "SENT" }), false);
  assert.equal(canTransitionOutreach({ status: "APPROVED", draft: "Persoonlijk concept", target: "SENT" }), true);
  assert.equal(canTransitionOutreach({ status: "SENT", draft: "Persoonlijk concept", target: "SENT" }), false);
});

test("only an approved outreach can be reopened and only a draft can be regenerated", () => {
  assert.equal(canReopenOutreach("APPROVED"), true);
  assert.equal(canReopenOutreach("SENT"), false);
  assert.equal(canRegenerateOutreach("DRAFT"), true);
  assert.equal(canRegenerateOutreach("APPROVED"), false);
  assert.equal(canRegenerateOutreach("SENT"), false);
});
