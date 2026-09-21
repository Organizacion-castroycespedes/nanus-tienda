import assert from "node:assert/strict";
import test from "node:test";
import {
  getCashAuditsReportExcel,
  getCashAuditsReportPdf,
  getCashClosingsReportExcel,
  getCashClosingsReportPdf,
} from "./reporting.service";

test("cash document actions preserve filters and select separate endpoints", async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return new Response(new Uint8Array([80, 75, 3, 4]), { status: 200 });
  };
  try {
    const filters = { tenantId: "tenant-1", branchId: "branch-1", dateFrom: "2026-09-01", dateTo: "2026-09-20" };
    await getCashClosingsReportPdf(filters);
    await getCashClosingsReportExcel(filters);
    await getCashAuditsReportPdf(filters);
    await getCashAuditsReportExcel(filters);
    assert.equal(urls.length, 4);
    assert.match(urls[0], /reports\/cash-closings\?.*format=pdf/);
    assert.match(urls[1], /reports\/cash-closings\?.*format=xlsx/);
    assert.match(urls[2], /reports\/cash-audits\?.*format=pdf/);
    assert.match(urls[3], /reports\/cash-audits\?.*format=xlsx/);
    for (const url of urls) {
      assert.match(url, /tenantId=tenant-1/);
      assert.match(url, /branchId=branch-1/);
      assert.match(url, /dateFrom=2026-09-01/);
      assert.match(url, /dateTo=2026-09-20/);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
