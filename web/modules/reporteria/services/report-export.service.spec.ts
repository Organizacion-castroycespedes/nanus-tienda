import assert from "node:assert/strict";
import test from "node:test";
import { getPosSalesReportExcel, getPosSalesReportPdf } from "./reporting.service";

test("POS document actions keep report filters in PDF and Excel requests", async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return new Response(new Uint8Array([80, 75, 3, 4]), {
      status: 200,
      headers: { "Content-Type": "application/octet-stream" },
    });
  };
  try {
    const filters = {
      tenantId: "tenant-1",
      branchId: "branch-1",
      dateFrom: "2026-09-20T00:00:00.000Z",
      dateTo: "2026-09-21T00:00:00.000Z",
    };
    await getPosSalesReportPdf(filters);
    await getPosSalesReportExcel(filters);
    assert.equal(urls.length, 2);
    for (const url of urls) {
      assert.match(url, /reports\/pos-sales\?/);
      assert.match(url, /tenantId=tenant-1/);
      assert.match(url, /branchId=branch-1/);
      assert.match(url, /dateFrom=/);
      assert.match(url, /dateTo=/);
    }
    assert.match(urls[0], /format=pdf/);
    assert.match(urls[1], /format=xlsx/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
