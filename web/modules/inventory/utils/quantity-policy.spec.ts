import { describe, expect, it } from "vitest";
import {
  getQuantityPolicyViolation,
  getQuantityStep,
  isIntegerOnlyQuantity,
  roundQuantity,
} from "./quantity-policy";

describe("quantity-policy", () => {
  it("producto por unidad sin marca solo acepta enteros", () => {
    expect(isIntegerOnlyQuantity({ saleType: "UNIT" })).toBe(true);
    expect(getQuantityPolicyViolation(10, { saleType: "UNIT" })).toBeNull();
    expect(getQuantityPolicyViolation(10.85, { saleType: "UNIT" })).toMatch(/unidades enteras/);
    expect(getQuantityStep({ saleType: "UNIT" })).toBe("1");
  });

  it("producto con marca acepta hasta 2 decimales", () => {
    const policy = { saleType: "UNIT", allowsDecimalQuantity: true };
    expect(isIntegerOnlyQuantity(policy)).toBe(false);
    expect(getQuantityPolicyViolation(10.85, policy)).toBeNull();
    expect(getQuantityPolicyViolation(1.255, policy)).toMatch(/máximo 2 decimales/);
    expect(getQuantityStep(policy)).toBe("0.01");
  });

  it("peso no se restringe", () => {
    expect(getQuantityPolicyViolation(1.234, { saleType: "WEIGHT" })).toBeNull();
  });

  it("roundQuantity elimina el ruido de 11 - 10.85", () => {
    expect(roundQuantity(11 - 10.85)).toBe(0.15);
  });
});
