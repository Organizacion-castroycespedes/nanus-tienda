import assert from "node:assert/strict";
import test from "node:test";
import { classifyFactuCoreContextFailure } from "../src/modules/electronic-billing/admin/electronic-billing-admin.service";
import { ElectronicBillingCredentialResolutionError } from "../src/modules/electronic-billing/credentials/electronic-billing-credential-resolver";
import {
  FactuCoreAuthenticationError,
  FactuCoreConfigurationError,
  FactuCoreNetworkError,
  FactuCoreTimeoutError,
  FactuCoreUnavailableError,
} from "../src/modules/electronic-billing/providers/factucore/factucore.errors";

const classify = (error: Error & { responseBodyPresent?: boolean }) => {
  return classifyFactuCoreContextFailure(error);
};

test("classifies FactuCore HTTP 401 from the typed httpStatus contract", () => {
  const error = new FactuCoreAuthenticationError("get_client_context", 401);
  error.responseBodyPresent = true;

  assert.deepEqual(classify(error), {
    category: "FACTUCORE_AUTHENTICATION_401",
    layer: "factucore-http",
    upstreamStatus: 401,
    responseBodyPresent: true,
  });
});

test("classifies FactuCore HTTP 403 without exposing the provider response", () => {
  const error = new FactuCoreAuthenticationError("get_client_context", 403, "clientSecret=hidden");
  error.responseBodyPresent = false;
  const result = classify(error);

  assert.equal(result.category, "FACTUCORE_AUTHORIZATION_403");
  assert.equal(result.upstreamStatus, 403);
  assert.equal(result.responseBodyPresent, false);
  assert.doesNotMatch(JSON.stringify(result), /hidden|clientSecret|ciphertext/i);
});

test("preserves bounded upstream status for FactuCore 5xx", () => {
  const error = new FactuCoreUnavailableError("get_client_context", 503);
  error.responseBodyPresent = true;

  assert.deepEqual(classify(error), {
    category: "FACTUCORE_CONTEXT_UNAVAILABLE",
    layer: "factucore-http",
    upstreamStatus: 503,
    responseBodyPresent: true,
  });
});

test("keeps timeout, network and credential failures statusless", () => {
  assert.equal(classify(new FactuCoreTimeoutError("get_client_context")).category, "FACTUCORE_TIMEOUT");
  assert.equal(classify(new FactuCoreNetworkError("get_client_context")).category, "FACTUCORE_NETWORK");
  assert.equal(
    classify(new ElectronicBillingCredentialResolutionError("credential failure", "TEST_FAILURE")).category,
    "CREDENTIAL_RESOLUTION_FAILED",
  );
  for (const error of [
    new FactuCoreTimeoutError("get_client_context"),
    new FactuCoreNetworkError("get_client_context"),
    new ElectronicBillingCredentialResolutionError("credential failure", "TEST_FAILURE"),
  ]) {
    const result = classify(error);
    assert.equal(result.upstreamStatus, null);
    assert.equal(result.responseBodyPresent, false);
    assert.equal(result.layer, "billing-backend");
  }
});

test("unknown configuration errors remain safely bounded", () => {
  const result = classify(new FactuCoreConfigurationError("get_client_context", "url=secret-value"));

  assert.deepEqual(result, {
    category: "FACTUCORE_CONTEXT_UNAVAILABLE",
    layer: "billing-backend",
    upstreamStatus: null,
    responseBodyPresent: false,
  });
  assert.doesNotMatch(JSON.stringify(result), /secret-value|url|header|token/i);
});
