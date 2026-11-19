import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "modules/finance/components/DocumentPaymentForm.tsx"),
  "utf8"
);

describe("DocumentPaymentForm financial institution contract", () => {
  it("uses one active tenant-visible catalog without a payment method filter", () => {
    expect(source).toContain("loadActiveFinancialInstitutions(listFinancialInstitutions)");
    expect(source).toContain("institutions={financialInstitutions}");
    expect(source).not.toContain("institutionsByMethodId");
    expect(source).not.toContain("loadFinancialInstitutionsByPaymentMethod");
  });

  it("keeps selection per line and clears it when the method changes", () => {
    expect(source).toMatch(/financialInstitutionId: string \| null/);
    expect(source).toMatch(
      /field === "paymentMethodId"[\s\S]*financialInstitutionId: null/
    );
    expect(source).toContain("financialInstitutionId: payment.financialInstitutionId ?? undefined");
  });

  it("keeps required-institution and active-catalog validation", () => {
    expect(source).toContain("getRequiresFinancialInstitutionForPos(payment.method)");
    expect(source).toContain("isActiveFinancialInstitutionAvailable(");
    expect(source).toContain(
      "Los metodos que exigen entidad financiera deben llevar banco o billetera."
    );
  });
});
