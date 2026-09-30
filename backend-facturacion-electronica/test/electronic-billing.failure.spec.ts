import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFailureDetailsFromError,
  buildFailureDetailsFromProviderResult,
  buildResolutionCandidates,
  extractDianRuleCode,
  resolveOutcomeFailureClass,
} from "../src/modules/electronic-billing/domain/electronic-billing-failure";
import { buildCreditNoteExternalReference } from "../src/modules/electronic-billing/services/electronic-billing-credit-note.service";
import {
  FactuCoreNetworkError,
  FactuCoreValidationError,
} from "../src/modules/electronic-billing/providers/factucore/factucore.errors";

test("extractDianRuleCode reads rule from DIAN message or code", () => {
  assert.equal(extractDianRuleCode(null, "Regla: FAK61, Rechazo: adquiriente"), "FAK61");
  assert.equal(extractDianRuleCode("FAB22b", null), "FAB22b");
  assert.equal(extractDianRuleCode("99", "Documento con errores"), null);
});

test("buildResolutionCandidates tries exact rule, code and rule prefix", () => {
  assert.deepEqual(buildResolutionCandidates("99", "Regla: FAT07, Rechazo: tributo"), ["FAT07", "99", "DIAN_PREFIX_FAT"]);
  assert.deepEqual(buildResolutionCandidates("FACTUCORE_TIMEOUT", "timeout"), ["FACTUCORE_TIMEOUT"]);
});

test("provider REJECTED result keeps every DIAN error as failure detail", () => {
  const details = buildFailureDetailsFromProviderResult(
    {
      documentId: "doc-1",
      providerStatus: "REJECTED",
      normalizedStatus: "REJECTED",
      providerStatusCode: "99",
      failureClass: "DIAN_REJECTED",
      probableCause: "OUR_PAYLOAD_REJECTED",
      providerErrors: [
        { code: null, message: "Regla: FAK61, Rechazo: adquiriente", path: null, severity: "REJECTION" },
        { code: "DAJ39", message: "Regla: DAJ39, Notificación", path: null, severity: "NOTIFICATION" },
      ],
    },
    "REJECTED",
  );

  assert.equal(details.length, 2);
  assert.equal(details[0].origin, "DIAN");
  assert.equal(details[0].failureClass, "DIAN_REJECTED");
  assert.deepEqual(details[0].resolutionCandidates, ["FAK61", "DIAN_PREFIX_FAK"]);
  assert.equal(details[1].code, "DAJ39");
});

test("provider ACCEPTED result stores no failure detail", () => {
  const details = buildFailureDetailsFromProviderResult(
    { documentId: "doc-1", providerStatus: "ACCEPTED", normalizedStatus: "ACCEPTED" },
    "ACCEPTED",
  );
  assert.deepEqual(details, []);
});

test("network error is classified transient with FactuCore origin", () => {
  const error = new FactuCoreNetworkError("issue_invoice");
  const details = buildFailureDetailsFromError(error, {
    code: error.code,
    message: error.message,
    httpStatus: null,
    classification: { rejected: false, retryable: true },
  });

  assert.equal(details.length, 1);
  assert.equal(details[0].origin, "FACTUCORE");
  assert.equal(details[0].failureClass, "NETWORK_OR_TRANSIENT");
  assert.deepEqual(details[0].resolutionCandidates, ["FACTUCORE_NETWORK"]);
});

test("validation error keeps each FactuCore validation detail", () => {
  const error = new FactuCoreValidationError(
    "issue_invoice",
    422,
    "customer.email: invalid",
    [
      { path: "customer.email", message: "email must be valid" },
      { path: "lines.0.taxes", message: "tax required" },
    ],
    "INVOICE_VALIDATION_FAILED",
  );
  const details = buildFailureDetailsFromError(error, {
    code: error.code,
    message: error.message,
    httpStatus: 422,
    classification: { rejected: true, retryable: false },
  });

  assert.equal(details.length, 2);
  assert.equal(details[0].failureClass, "VALIDATION");
  assert.equal(details[0].path, "customer.email");
  assert.equal(details[0].code, "INVOICE_VALIDATION_FAILED");
  assert.ok(details[0].resolutionCandidates.includes("FACTUCORE_VALIDATION"));
});

test("resolveOutcomeFailureClass maps document status to POS outcome", () => {
  assert.equal(resolveOutcomeFailureClass("ACCEPTED", []), "ACCEPTED");
  assert.equal(resolveOutcomeFailureClass("PROCESSING", []), "PENDING");
  assert.equal(resolveOutcomeFailureClass("REJECTED", []), "DIAN_REJECTED");
  assert.equal(resolveOutcomeFailureClass("REJECTED", ["VALIDATION"]), "VALIDATION");
  assert.equal(resolveOutcomeFailureClass("TECHNICAL_ERROR", []), "NETWORK_OR_TRANSIENT");
});

test("credit note external reference is deterministic per reissue attempt", () => {
  assert.equal(buildCreditNoteExternalReference("SALE-1", 1), "CN-SALE-1");
  assert.equal(buildCreditNoteExternalReference("SALE-1", 2), "CN-SALE-1-2");
});
