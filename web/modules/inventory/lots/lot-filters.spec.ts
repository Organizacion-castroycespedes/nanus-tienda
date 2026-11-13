import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLotFilterChips,
  clearLotFilter,
  createDefaultLotFilters,
  readLotFiltersFromSearchParams,
} from "./lot-filters";

const B1 = "00000000-0000-0000-0000-0000000000b1";
const B2 = "00000000-0000-0000-0000-0000000000b2";
const L1 = "00000000-0000-0000-0000-0000000000c1";

const labels = {
  branch: (id: string) => (id === B1 ? "Principal" : "Norte"),
  product: () => "Leche 1L",
  location: () => "002 - Licores",
  status: () => "Activo",
  date: (value: string) => value,
};

const params = (values: Record<string, string>) => ({
  get: (name: string) => values[name] ?? null,
});

describe("lot-filters", () => {
  it("crea chips solo para filtros distintos del valor por defecto", () => {
    const defaults = createDefaultLotFilters(B1);
    const applied = { ...defaults, status: "ACTIVE" as const, locationId: L1 };
    const chips = buildLotFilterChips(applied, defaults, labels);
    assert.deepEqual(
      chips.map((chip) => `${chip.label}: ${chip.value}`),
      ["Estado: Activo", "Ubicación: 002 - Licores"]
    );
  });

  it("la sucursal por defecto del rol no es un chip", () => {
    const defaults = createDefaultLotFilters(B1);
    assert.equal(buildLotFilterChips(defaults, defaults, labels).length, 0);
  });

  it("quitar la sucursal también quita la ubicación", () => {
    const defaults = createDefaultLotFilters("");
    const next = clearLotFilter({ ...defaults, branchId: B2, locationId: L1 }, "branchId", defaults);
    assert.equal(next.branchId, "");
    assert.equal(next.locationId, "");
  });

  it("precarga sucursal y ubicación desde la URL para rol super", () => {
    const { filters, fromUrl } = readLotFiltersFromSearchParams(
      params({ branchId: B2, locationId: L1 }),
      { isSuperRole: true, currentBranch: B1 }
    );
    assert.equal(filters.branchId, B2);
    assert.equal(filters.locationId, L1);
    assert.equal(fromUrl, true);
  });

  it("rol operativo ignora una sucursal ajena y su ubicación", () => {
    const { filters, fromUrl } = readLotFiltersFromSearchParams(
      params({ branchId: B2, locationId: L1 }),
      { isSuperRole: false, currentBranch: B1 }
    );
    assert.equal(filters.branchId, B1);
    assert.equal(filters.locationId, "");
    assert.equal(fromUrl, false);
  });

  it("ignora valores inválidos", () => {
    const { filters, fromUrl } = readLotFiltersFromSearchParams(
      params({ productId: "abc", status: "foo" }),
      { isSuperRole: true, currentBranch: null }
    );
    assert.equal(filters.productId, "");
    assert.equal(filters.status, "");
    assert.equal(fromUrl, false);
  });
});
