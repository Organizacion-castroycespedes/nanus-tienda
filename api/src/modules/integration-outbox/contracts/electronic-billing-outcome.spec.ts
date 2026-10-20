import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOnlineResultFromDelivery,
  buildOnlineResultFromDocument,
  readBillingElectronicDocumentOutcome,
  resolveOnlineStatusFromDocument,
  type BillingElectronicDocumentOutcome,
} from "./electronic-billing-outcome";

const baseDocument = (overrides: Partial<BillingElectronicDocumentOutcome> = {}): BillingElectronicDocumentOutcome => ({
  electronicDocumentId: "doc-1",
  documentType: "INVOICE",
  status: "ACCEPTED",
  fullNumber: "SETP990000001",
  cufe: "cufe-1",
  cude: null,
  providerStatus: "ACCEPTED",
  failureClass: "ACCEPTED",
  retryable: false,
  errorCode: null,
  errorMessage: null,
  failures: [],
  ...overrides,
});

test("resolveOnlineStatusFromDocument maps fiscal statuses to POS statuses", () => {
  assert.equal(resolveOnlineStatusFromDocument(baseDocument()), "ACCEPTED");
  assert.equal(resolveOnlineStatusFromDocument(baseDocument({ status: "REJECTED" })), "REJECTED");
  assert.equal(
    resolveOnlineStatusFromDocument(baseDocument({ status: "TECHNICAL_ERROR", retryable: true })),
    "QUEUED_NETWORK",
  );
  assert.equal(
    resolveOnlineStatusFromDocument(baseDocument({ status: "TECHNICAL_ERROR", retryable: false })),
    "REJECTED",
  );
  assert.equal(resolveOnlineStatusFromDocument(baseDocument({ status: "PROCESSING" })), "PROCESSING");
});

test("buildOnlineResultFromDocument exposes the first failure code and solution", () => {
  const result = buildOnlineResultFromDocument(baseDocument({
    status: "REJECTED",
    failureClass: "DIAN_REJECTED",
    failures: [{
      code: "FAK61",
      message: "Regla: FAK61, Rechazo: correo del adquiriente",
      origin: "DIAN",
      path: null,
      severity: "REJECTION",
      title: "Correo del adquiriente",
      solution: "Registrar un correo válido del cliente.",
      retryable: false,
    }],
  }));

  assert.equal(result.status, "REJECTED");
  assert.equal(result.errorCode, "FAK61");
  assert.equal(result.failures[0]?.solution, "Registrar un correo válido del cliente.");
});

test("buildOnlineResultFromDelivery marks network failures as queued", () => {
  const result = buildOnlineResultFromDelivery({
    outcome: "RETRYABLE",
    statusCode: null,
    errorCode: "BILLING_BACKEND_UNREACHABLE",
    message: "fetch failed",
    electronicDocument: null,
  });

  assert.equal(result.status, "QUEUED_NETWORK");
  assert.equal(result.failureClass, "NETWORK_OR_TRANSIENT");
  assert.equal(result.errorCode, "BILLING_BACKEND_UNREACHABLE");
});

test("buildOnlineResultFromDelivery gives a solution for ineligible fiscal snapshots", () => {
  const result = buildOnlineResultFromDelivery({
    outcome: "FAILED",
    statusCode: null,
    errorCode: "OUTBOX_EVENT_INELIGIBLE_SNAPSHOT",
    message: "Datos fiscales incompletos",
    electronicDocument: null,
  });

  assert.equal(result.status, "REJECTED");
  assert.equal(result.failureClass, "VALIDATION");
  assert.ok(result.failures[0]?.solution);
});

test("buildOnlineResultFromDelivery prefers the billing document outcome", () => {
  const result = buildOnlineResultFromDelivery({
    outcome: "PUBLISHED",
    statusCode: 201,
    errorCode: null,
    message: null,
    electronicDocument: baseDocument(),
  });

  assert.equal(result.status, "ACCEPTED");
  assert.equal(result.fullNumber, "SETP990000001");
});

test("readBillingElectronicDocumentOutcome validates and normalizes the payload", () => {
  assert.equal(readBillingElectronicDocumentOutcome(null), null);
  assert.equal(readBillingElectronicDocumentOutcome({ status: "ACCEPTED" }), null);

  const parsed = readBillingElectronicDocumentOutcome({
    electronicDocumentId: "doc-9",
    status: "REJECTED",
    failures: [{ code: "99", message: "Validación", origin: "DIAN" }, "invalid"],
  });

  assert.ok(parsed);
  assert.equal(parsed.documentType, "INVOICE");
  assert.equal(parsed.failureClass, "UNKNOWN");
  assert.equal(parsed.failures.length, 1);
  assert.equal(parsed.failures[0]?.origin, "DIAN");
});
