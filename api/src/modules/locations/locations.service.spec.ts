import assert from "node:assert/strict";
import test from "node:test";
import { LocationsService } from "./locations.service";

test("validates the Colombian fiscal location hierarchy", async () => {
  const db = {
    query: async () => ({ rows: [{}] }),
  };
  const service = new LocationsService(db as never);

  await service.validateFiscalHierarchy("CO", "08", "08001");
});

test("rejects an invalid fiscal location hierarchy", async () => {
  const db = {
    query: async () => ({ rows: [] }),
  };
  const service = new LocationsService(db as never);

  await assert.rejects(
    service.validateFiscalHierarchy("CO", "08", "11001"),
    /fiscal location hierarchy is invalid/
  );
});

test("requires complete location codes for Colombia", async () => {
  const db = { query: async () => ({ rows: [] }) };
  const service = new LocationsService(db as never);

  await assert.rejects(
    service.validateFiscalHierarchy("CO", "08", null),
    /fiscal location is incomplete/
  );
});

test("resolves canonical codes from catalog identifiers", async () => {
  const db = {
    query: async () => ({
      rows: [
        {
          country_id: "country-1",
          country_code: "CO",
          department_id: "department-1",
          department_code: "08",
          municipality_id: "municipality-1",
          municipality_code: "08001",
        },
      ],
    }),
  };
  const service = new LocationsService(db as never);

  const location = await service.resolveCanonicalLocation({
    departmentId: "department-1",
    municipalityId: "municipality-1",
  });

  assert.equal(location.country_code, "CO");
  assert.equal(location.department_code, "08");
  assert.equal(location.municipality_code, "08001");
});

test("rejects a catalog hierarchy mismatch", async () => {
  const service = new LocationsService({
    query: async () => ({ rows: [] }),
  } as never);

  await assert.rejects(
    service.resolveCanonicalLocation({
      countryId: "country-1",
      departmentId: "department-1",
      municipalityId: "municipality-from-other-department",
    }),
    /fiscal location hierarchy is invalid/
  );
});
