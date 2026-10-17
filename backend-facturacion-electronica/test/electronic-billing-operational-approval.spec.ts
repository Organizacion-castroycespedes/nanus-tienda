import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseElectronicBillingOperationalApproval } from "../src/modules/electronic-billing/admin/electronic-billing-operational-approval.repository";

const activeKeyId = "qa-2026-01";

const validRow = () => ({
  key_owner_identity: "owner-user",
  recovery_verifier_identity: "recovery-user",
  approval_identity: "approver-user",
  evidence_reference: "qa-recovery-record-1",
  evidence_fingerprint: "a".repeat(64),
  evidence_verification_status: "VERIFIED",
  recovery_verification_status: "VERIFIED",
  recovery_verified_at: "2026-10-15T10:00:00.000Z",
  approved_at: "2026-10-15T10:01:00.000Z",
  expires_at: "2027-10-15T10:01:00.000Z",
  status: "APPROVED",
  revoked_at: null,
});

const withKey = async (run: () => Promise<void>) => {
  const previous = process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID;
  process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID = activeKeyId;
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID;
    else process.env.ELECTRONIC_BILLING_ENCRYPTION_ACTIVE_KEY_ID = previous;
  }
};

test("operational approval stays UNKNOWN without a durable row", async () => {
  await withKey(async () => {
    const provider = new DatabaseElectronicBillingOperationalApproval({
      query: async () => ({ rows: [] }),
    } as never);
    assert.deepEqual(await provider.getApproval(), {
      operationalOwnership: "UNKNOWN",
      recoveryReadiness: "UNKNOWN",
    });
  });
});

test("operational approval requires one valid independent QA evidence row", async () => {
  await withKey(async () => {
    const provider = new DatabaseElectronicBillingOperationalApproval({
      query: async () => ({ rows: [validRow()] }),
    } as never);
    assert.deepEqual(await provider.getApproval(), {
      operationalOwnership: "APPROVED",
      recoveryReadiness: "APPROVED",
    });
  });
});

test("approval denies duplicate, expired, revoked, mismatched, or unverifiable evidence", async () => {
  await withKey(async () => {
    for (const rows of [
      [validRow(), validRow()],
      [{ ...validRow(), expires_at: "2020-01-01T00:00:00.000Z" }],
      [{ ...validRow(), status: "REVOKED", revoked_at: "2026-10-16T00:00:00.000Z" }],
      [{ ...validRow(), evidence_verification_status: "CLAIMED" }],
      [{ ...validRow(), key_owner_identity: "same-user", recovery_verifier_identity: "same-user" }],
    ]) {
      const provider = new DatabaseElectronicBillingOperationalApproval({
        query: async () => ({ rows }),
      } as never);
      assert.deepEqual(await provider.getApproval(), {
        operationalOwnership: "UNKNOWN",
        recoveryReadiness: "UNKNOWN",
      });
    }
  });
});

test("database failure fails closed", async () => {
  await withKey(async () => {
    const provider = new DatabaseElectronicBillingOperationalApproval({
      query: async () => { throw new Error("database unavailable"); },
    } as never);
    assert.deepEqual(await provider.getApproval(), {
      operationalOwnership: "UNKNOWN",
      recoveryReadiness: "UNKNOWN",
    });
  });
});
