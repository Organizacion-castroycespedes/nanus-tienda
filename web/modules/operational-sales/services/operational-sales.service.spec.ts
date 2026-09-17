import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  createSinglePostGuard,
  isEligibleForElectronicBillingRequest,
  providerCreateIntentRecoveryMessage,
  PROVIDER_CREATE_INTENT_RECOVERY_CONFIRMATION,
  shouldShowProviderCreateIntentRecovery,
} from "./operational-sales.service";

const sale = (overrides: Record<string, unknown> = {}) => ({
  status: "CONFIRMED",
  paymentStatus: "PAID",
  customer: { id: "customer-1", name: "Cliente QA" },
  electronicBilling: null,
  ...overrides,
});

test("electronic billing action is eligible only for paid confirmed sales without a document", () => {
  assert.equal(isEligibleForElectronicBillingRequest(sale()), true);
  assert.equal(isEligibleForElectronicBillingRequest(sale({ status: "DRAFT" })), false);
  assert.equal(isEligibleForElectronicBillingRequest(sale({ paymentStatus: "PENDING" })), false);
  assert.equal(
    isEligibleForElectronicBillingRequest(
      sale({ electronicBilling: { status: "PENDING" } })
    ),
    false
  );
});

test("electronic billing action requires a persisted customer reference", () => {
  assert.equal(
    isEligibleForElectronicBillingRequest(sale({ customer: { id: "" } })),
    false
  );
});

test("provider-create recovery visibility uses only backend capability and write permission", () => {
  const recoverable = sale({
    electronicBilling: {
      status: "TECHNICAL_ERROR",
      retryability: { canRecoverProviderCreateIntent: true },
    },
  });
  assert.equal(shouldShowProviderCreateIntentRecovery(recoverable as never, true), true);
  assert.equal(shouldShowProviderCreateIntentRecovery(recoverable as never, false), false);

  const existingProvider = sale({
    electronicBilling: {
      status: "TECHNICAL_ERROR",
      retryability: { canRecoverProviderCreateIntent: false, canRecoverExistingProvider: true },
    },
  });
  assert.equal(shouldShowProviderCreateIntentRecovery(existingProvider as never, true), true);

  for (const status of ["ACCEPTED", "REJECTED", "PROCESSING", "CANCELLED", "TECHNICAL_ERROR"]) {
    const ineligible = sale({
      electronicBilling: {
        status,
        retryability: { canRecoverProviderCreateIntent: false },
      },
    });
    assert.equal(shouldShowProviderCreateIntentRecovery(ineligible as never, true), false, status);
  }
});

test("provider-create recovery single-post guard blocks concurrent double interaction", async () => {
  const guard = createSinglePostGuard();
  let calls = 0;
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => { release = resolve; });

  const first = guard.run(async () => {
    calls += 1;
    await pending;
    return "done";
  });
  const second = await guard.run(async () => {
    calls += 1;
    return "duplicate";
  });

  assert.equal(second.started, false);
  assert.equal(calls, 1);
  release?.();
  assert.equal((await first).started, true);
});

test("provider-create recovery messages and UI wiring stay dedicated", () => {
  assert.match(PROVIDER_CREATE_INTENT_RECOVERY_CONFIRMATION, /FactuCore/);
  assert.match(PROVIDER_CREATE_INTENT_RECOVERY_CONFIRMATION, /DIAN/);
  assert.match(providerCreateIntentRecoveryMessage("REMOTE_NOT_FOUND_RECOVERED"), /continuar/);
  assert.match(providerCreateIntentRecoveryMessage("REMOTE_FOUND_RECONCILED"), /reconcili/);

  const serviceSource = readFileSync(join(process.cwd(), "modules", "operational-sales", "services", "operational-sales.service.ts"), "utf8");
  const hookSource = readFileSync(join(process.cwd(), "modules", "operational-sales", "hooks", "use-operational-sale-detail.ts"), "utf8");
  const componentSource = readFileSync(join(process.cwd(), "modules", "operational-sales", "components", "OperationalSaleDetailPage.tsx"), "utf8");
  assert.match(serviceSource, /electronic-billing\/recover-provider-create-intent/);
  assert.match(hookSource, /recoveryPostGuard\.run/);
  assert.match(componentSource, /ConfirmDialog/);
  assert.match(componentSource, /setRecoveryConfirmOpen\(true\)/);
  assert.doesNotMatch(componentSource, /window\.confirm\(PROVIDER_CREATE_INTENT_RECOVERY_CONFIRMATION\)/);
  assert.match(componentSource, /confirmText="Recuperar procesamiento"/);
  assert.match(componentSource, /cancelText="Cancelar"/);
  assert.match(componentSource, /Recuperar procesamiento/);
});
