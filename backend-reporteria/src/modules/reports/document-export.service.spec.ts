import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import { BadRequestException } from "@nestjs/common";
import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants";
import { DatabaseService } from "../database/database.service";
import { DocumentExportService, MAX_REPORT_EXPORT_ROWS, REPORT_EXPORT_BATCH_SIZE } from "./document-export.service";

const fakeClient = () => {
  const calls: string[] = [];
  return {
    calls,
    query: async (sql: string) => { calls.push(sql); return { rows: [] }; },
    release: () => undefined,
  };
};

test("DocumentExportService declares the real DatabaseService injection token", () => {
  const dependencies = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, DocumentExportService) as Array<{
    index: number;
    param: unknown;
  }>;
  assert.ok(dependencies.some((dependency) => dependency.index === 0 && dependency.param === DatabaseService));
});

test("DocumentExportService reads every real batch in one read-only snapshot", async () => {
  const client = fakeClient();
  const service = new DocumentExportService({
    getClient: async () => client,
  } as never);
  const rows = await service.collect(
    async () => REPORT_EXPORT_BATCH_SIZE * 2 + 1,
    async (_transaction, offset, limit) => Array.from(
      { length: Math.min(limit, REPORT_EXPORT_BATCH_SIZE * 2 + 1 - offset) },
      (_, index) => offset + index,
    ),
  );

  assert.equal(rows.length, REPORT_EXPORT_BATCH_SIZE * 2 + 1);
  assert.deepEqual(client.calls, [
    "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
    "COMMIT",
  ]);
});

test("DocumentExportService rejects oversized reports before reading batches", async () => {
  const client = fakeClient();
  const service = new DocumentExportService({ getClient: async () => client } as never);

  await assert.rejects(
    service.collect(async () => MAX_REPORT_EXPORT_ROWS + 1, async () => []),
    (error: unknown) => error instanceof BadRequestException && /100000/.test(String(error.message)),
  );
  assert.deepEqual(client.calls, [
    "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
    "ROLLBACK",
  ]);
});

test("DocumentExportService rejects a short batch instead of truncating", async () => {
  const client = fakeClient();
  const service = new DocumentExportService({ getClient: async () => client } as never);

  await assert.rejects(
    service.collect(async () => 2, async () => [1]),
    /Report changed while exporting/,
  );
  assert.deepEqual(client.calls, [
    "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
    "ROLLBACK",
  ]);
});

test("DocumentExportService returns summary from the same repeatable snapshot", async () => {
  const client = fakeClient();
  const service = new DocumentExportService({ getClient: async () => client } as never);
  const result = await service.collectWithSummary(
    async () => ({ totalRows: 2, summary: { totalCost: "12.50" } }),
    async () => ["row-1", "row-2"],
  );
  assert.deepEqual(result, { rows: ["row-1", "row-2"], summary: { totalCost: "12.50" } });
});
