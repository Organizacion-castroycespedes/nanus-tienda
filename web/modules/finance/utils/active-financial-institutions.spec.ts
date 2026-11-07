import { describe, expect, it, vi } from "vitest";
import type { FinancialInstitution } from "../types";
import {
  isActiveFinancialInstitutionAvailable,
  loadActiveFinancialInstitutions,
} from "./active-financial-institutions";

const institution = (
  id: string,
  tenantId: string | null,
  active = true
): FinancialInstitution => ({
  id,
  tenantId,
  codigo: id.toUpperCase(),
  nombre: id,
  nombreCorto: id,
  tipo: "BANK",
  logoUrl: null,
  active,
  sortOrder: 0,
  createdAt: "2026-11-06T00:00:00.000Z",
  updatedAt: "2026-11-06T00:00:00.000Z",
});

describe("active financial institution catalog for document payments", () => {
  it("loads once without paymentMethodId and preserves global and tenant institutions", async () => {
    const activeGlobal = institution("global-bank", null);
    const activeTenant = { ...institution("tenant-wallet", "tenant-a"), tipo: "WALLET" as const };
    const inactiveTenant = institution("inactive-bank", "tenant-a", false);
    const loader = vi.fn(async () => [activeGlobal, activeTenant, inactiveTenant]);

    const result = await loadActiveFinancialInstitutions(loader);

    expect(loader).toHaveBeenCalledOnce();
    expect(loader).toHaveBeenCalledWith(undefined, true);
    expect(result).toEqual([activeGlobal, activeTenant]);
  });

  it("accepts only an active institution returned by the tenant-scoped API", () => {
    const activeGlobal = institution("global-bank", null);
    const inactiveTenant = institution("inactive-bank", "tenant-a", false);

    expect(isActiveFinancialInstitutionAvailable([activeGlobal], activeGlobal.id)).toBe(true);
    expect(isActiveFinancialInstitutionAvailable([inactiveTenant], inactiveTenant.id)).toBe(false);
    expect(isActiveFinancialInstitutionAvailable([activeGlobal], "foreign-or-missing")).toBe(false);
  });
});
