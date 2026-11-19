import assert from "node:assert/strict";
import test from "node:test";
import { parseAccountCreate, parseAccountPatch } from "../accounts/accounts.parsers";
import { parseContractAmend, parseContractCreate, parseIdempotencyKey } from "../contracts/contracts.parsers";
import { parsePlanCreate, parsePlanPatch, parsePriceVersion } from "../plans/plans.parsers";
import { decodeCursor, encodeCursor } from "../tenant-directory/tenant-directory.service";
import { likePattern } from "./parsing";

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (error: any) {
    return error.getResponse?.().code;
  }
  return null;
};

const uuid = "11111111-1111-4111-8111-111111111111";

test("accounts: normalizes NIT and email, requires phone for WhatsApp consent", () => {
  const input = parseAccountCreate({
    legalName: " Comercial ABC SAS ",
    taxIdType: "nit",
    taxId: "900.123.456-7",
    billingEmail: "Pagos@ABC.com",
  });
  assert.equal(input.taxId, "9001234567");
  assert.equal(input.taxIdType, "NIT");
  assert.equal(input.billingEmail, "pagos@abc.com");
  assert.equal(input.whatsappOptIn, false);
  assert.equal(
    code(() => parseAccountCreate({ legalName: "X", taxIdType: "NIT", taxId: "1", billingEmail: "a@b.co", whatsappOptIn: true })),
    "CONTROL_CENTER_WHATSAPP_PHONE_REQUIRED",
  );
  assert.equal(
    code(() => parseAccountCreate({ legalName: "X", taxIdType: "NIT", taxId: "1", billingEmail: "a@b.co", contactPhoneE164: "3001234567" })),
    "CONTROL_CENTER_INVALID_PHONE",
  );
});

test("accounts: tax identification cannot change through PATCH", () => {
  assert.equal(code(() => parseAccountPatch({ taxId: "1" })), "CONTROL_CENTER_IMMUTABLE_FIELD");
  assert.equal(code(() => parseAccountPatch({})), "CONTROL_CENTER_EMPTY_PATCH");
  assert.deepEqual(parseAccountPatch({ status: "inactive" }), { status: "INACTIVE" });
});

test("plans: code normalization and retire requires reason", () => {
  assert.equal(parsePlanCreate({ code: "manus pos anual", name: "MANUS POS" }).code, "MANUS_POS_ANUAL");
  assert.equal(code(() => parsePlanPatch({ status: "RETIRED" })), "CONTROL_CENTER_REASON_REQUIRED");
  assert.equal(parsePlanPatch({ status: "RETIRED", reason: "Plan reemplazado por versión 2027" }).retire, true);
});

test("plans: price version validates components, tax and reason", () => {
  const version = parsePriceVersion({
    validFrom: "2026-11-01",
    taxId: uuid,
    includedPosTerminals: 1,
    components: [
      { component: "BASE_INITIAL_TERM", billingFrequency: "ANNUAL", amount: "850000" },
      { component: "CERTIFICATION", billingFrequency: "ANNUAL", amount: 119000 },
    ],
    reason: "Propuesta comercial noviembre 2026",
  });
  assert.equal(version.initialTermMonths, 12);
  assert.equal(version.defaultTrialMonths, 1);
  assert.equal(version.components[1].amount, "119000.00");
  assert.equal(
    code(() =>
      parsePriceVersion({
        validFrom: "2026-11-01",
        taxId: uuid,
        includedPosTerminals: 1,
        components: [{ component: "BASE_RENEWAL", billingFrequency: "MONTHLY", amount: "99900" }],
        reason: "Propuesta comercial noviembre 2026",
      }),
    ),
    "CONTROL_CENTER_REQUIRED_FIELD",
  );
  assert.equal(
    code(() =>
      parsePriceVersion({
        validFrom: "2026-11-01",
        taxId: uuid,
        includedPosTerminals: 1,
        components: [
          { component: "BASE_INITIAL_TERM", billingFrequency: "ANNUAL", amount: "1" },
          { component: "BASE_INITIAL_TERM", billingFrequency: "ANNUAL", amount: "2" },
        ],
        reason: "Propuesta comercial noviembre 2026",
      }),
    ),
    "CONTROL_CENTER_DUPLICATE_COMPONENT",
  );
});

test("contracts: create defaults and amend requires reason", () => {
  const input = parseContractCreate({
    accountId: uuid,
    tenantId: uuid,
    planId: uuid,
    startDate: "2026-12-15",
    billingFrequency: "annual",
  });
  assert.equal(input.billingFrequency, "ANNUAL");
  assert.equal(input.extraPosTerminals, 0);
  assert.equal(input.prorationPolicy, "DAILY");
  assert.equal(input.trialMonths, null);
  assert.equal(
    code(() => parseContractAmend({ effectiveFrom: "2027-12-15", termPhase: "RENEWAL", billingFrequency: "MONTHLY" })),
    "CONTROL_CENTER_REASON_REQUIRED",
  );
  assert.equal(
    code(() => parseContractCreate({ accountId: uuid, tenantId: uuid, planId: uuid, startDate: "2026-12-15", billingFrequency: "ANNUAL", overrides: { CERTIFICATION: {} } })),
    "CONTROL_CENTER_INVALID_FIELD",
  );
});

test("contracts: idempotency key format", () => {
  assert.equal(parseIdempotencyKey(undefined), null);
  assert.equal(parseIdempotencyKey("contract-2026-0001"), "contract-2026-0001");
  assert.equal(code(() => parseIdempotencyKey("short")), "CONTROL_CENTER_INVALID_IDEMPOTENCY_KEY");
});

test("directory: cursor roundtrip and LIKE escaping", () => {
  const cursor = encodeCursor("2026-05-01 10:00:00.123456-05", uuid);
  assert.deepEqual(decodeCursor(cursor), { createdAt: "2026-05-01 10:00:00.123456-05", id: uuid });
  assert.equal(code(() => decodeCursor("garbage")), "CONTROL_CENTER_INVALID_CURSOR");
  assert.equal(likePattern("50%_off"), "%50\\%\\_off%");
});
