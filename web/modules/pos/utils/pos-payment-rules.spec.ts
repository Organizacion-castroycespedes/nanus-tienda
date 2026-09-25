import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PaymentMethod } from "../../finance/types";
import {
  formatPosAmountDisplay,
  getRequiresFinancialInstitutionForPos,
  getRequiresReferenceForPos,
  parsePosAmountInput,
} from "./pos-payment-rules";

const method = (overrides: Partial<PaymentMethod>): PaymentMethod =>
  ({
    id: "m1",
    tenantId: "t1",
    codigo: "CASH",
    nombre: "Efectivo",
    tipo: "CASH",
    requiresReference: false,
    requiresFinancialInstitution: false,
    allowsChange: true,
    active: true,
    electronicBillingEnabled: false,
    electronicPaymentMeansCode: null,
    electronicPaymentMeansId: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  }) as PaymentMethod;

describe("pos-payment-rules", () => {
  it("keeps reference optional in POS", () => {
    assert.equal(getRequiresReferenceForPos(method({ requiresReference: false })), false);
    assert.equal(getRequiresReferenceForPos(method({ requiresReference: true })), false);
    assert.equal(getRequiresReferenceForPos(null), false);
  });

  it("never requires institution for cash", () => {
    assert.equal(
      getRequiresFinancialInstitutionForPos(
        method({ tipo: "CASH", requiresFinancialInstitution: true })
      ),
      false
    );
  });

  it("requires institution for bank/transfer/qr/pse types or flag", () => {
    assert.equal(
      getRequiresFinancialInstitutionForPos(method({ tipo: "BANK", codigo: "TRANSFER" })),
      true
    );
    assert.equal(
      getRequiresFinancialInstitutionForPos(
        method({ tipo: "DIGITAL", codigo: "QR_BREB", nombre: "QR Bre-B" })
      ),
      true
    );
    assert.equal(
      getRequiresFinancialInstitutionForPos(
        method({
          tipo: "CARD",
          codigo: "DEBIT",
          nombre: "Débito",
          requiresFinancialInstitution: true,
        })
      ),
      true
    );
    assert.equal(
      getRequiresFinancialInstitutionForPos(
        method({
          tipo: "CARD",
          codigo: "DEBIT",
          nombre: "Débito",
          requiresFinancialInstitution: false,
        })
      ),
      false
    );
  });

  it("parses and formats amounts without breaking backend numeric string", () => {
    assert.equal(parsePosAmountInput("199124.05"), "199124.05");
    assert.equal(parsePosAmountInput("$ 199.124,05"), "199124.05");
    assert.equal(parsePosAmountInput("100000"), "100000");
    assert.match(formatPosAmountDisplay("199124.05"), /199/);
  });
});
