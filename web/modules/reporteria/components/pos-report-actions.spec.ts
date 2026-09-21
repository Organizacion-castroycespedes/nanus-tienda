import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("POS toolbar removes legacy reconciliation action and keeps Reporte", () => {
  const source = readFileSync(resolve(process.cwd(), "modules/reporteria/components/PosReportsPage.tsx"), "utf8");
  assert.doesNotMatch(source, /Descargar reporte POS para conciliaci[oÃ³]n/);
  assert.match(source, /\bReporte\b/);
  assert.match(source, /getPosSalesReportExcel/);
  assert.match(source, /onDownloadExcel/);
});
