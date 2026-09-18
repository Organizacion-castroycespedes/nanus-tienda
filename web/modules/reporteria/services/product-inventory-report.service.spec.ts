import assert from "node:assert/strict";
import test from "node:test";
import { createProductInventoryReport, reportBase64ToBlob } from "./product-inventory-report.service";

test("report client sends filter intent to snapshot endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let request: { url: string; body: unknown } | null = null;
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), body: JSON.parse(String(init?.body)) };
    return new Response(JSON.stringify({ dataset: { rows: [], pagination: { page: 1, pageSize: 100, totalRows: 0, totalPages: 0 } }, pdfBase64: "" }),
      { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    await createProductInventoryReport({ branchId: "branch-intent", preset: "GENERAL" });
    assert.ok(request);
    assert.match((request as { url: string; body: unknown }).url, /reports\/product-inventory$/);
    assert.deepEqual((request as { url: string; body: unknown }).body,
      { branchId: "branch-intent", preset: "GENERAL", mode: "preview" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("preview PDF bytes are preserved for viewer and normal print", async () => {
  const blob = reportBase64ToBlob(Buffer.from("%PDF-test").toString("base64"), "application/pdf");
  assert.equal(blob.type, "application/pdf");
  assert.equal(Buffer.from(await blob.arrayBuffer()).toString(), "%PDF-test");
});
