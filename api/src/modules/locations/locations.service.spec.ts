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
