import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseService } from "../../../common/db/database.service";
import { FinancialInstitutionsRepository } from "./financial-institutions.repository";

type QueryCall = { text: string; params: unknown[] };

const buildRepository = () => {
  const calls: QueryCall[] = [];
  const db = {
    query: async (text: string, params: unknown[]) => {
      calls.push({ text, params });
      return { rows: [] };
    },
  } as unknown as DatabaseService;

  return { repository: new FinancialInstitutionsRepository(db), calls };
};

test("general catalog returns active tenant-visible and global institutions without method mapping", async () => {
  const { repository, calls } = buildRepository();

  await repository.list("tenant-a", undefined, true);

  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0].text, /payment_method_financial_institutions/);
  assert.match(
    calls[0].text,
    /fi\.tenant_id = \$1 OR fi\.tenant_id IS NULL/
  );
  assert.match(calls[0].text, /fi\.active = \$2/);
  assert.deepEqual(calls[0].params, ["tenant-a", true]);
});

test("method-filtered catalog requires active mapping and active tenant-visible or global institution", async () => {
  const { repository, calls } = buildRepository();

  await repository.list("tenant-a", "qr-breb-method", true);

  assert.equal(calls.length, 1);
  assert.match(
    calls[0].text,
    /INNER JOIN payment_method_financial_institutions pmfi/
  );
  assert.match(calls[0].text, /pmfi\.tenant_id = \$1/);
  assert.match(calls[0].text, /pmfi\.payment_method_id = \$2/);
  assert.match(calls[0].text, /pmfi\.active = TRUE/);
  assert.match(calls[0].text, /fi\.active = \$3/);
  assert.match(
    calls[0].text,
    /fi\.tenant_id = \$1 OR fi\.tenant_id IS NULL/
  );
  assert.deepEqual(calls[0].params, ["tenant-a", "qr-breb-method", true]);
});
