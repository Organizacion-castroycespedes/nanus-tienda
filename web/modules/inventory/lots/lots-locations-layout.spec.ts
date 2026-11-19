import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

// Pruebas por fuente (patrón de orders-responsive-layout.spec.ts) para
// change modernizar-inventario-lotes-ubicaciones. Ejecutar desde `web/`.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const lotsPage = read("app/[tenant]/inventory/lots/page.tsx");
const locationsPage = read("app/[tenant]/inventory/locations/page.tsx");
const lotModal = read("modules/inventory/components/InventoryLotDetailModal.tsx");

const headerOrder = (source: string) =>
  Array.from(source.matchAll(/<th scope="col"[^>]*>\s*([^<{]+?)\s*<\/th>/g)).map((match) =>
    match[1].trim()
  );

describe("Inventario > Lotes", () => {
  it("usa el panel colapsable compartido con preferencia propia", () => {
    assert.match(lotsPage, /<CollapsibleFilterPanel id="inventory-lots-filters" storageKey="inventory-lots"/);
  });

  it("filtra Producto con el selector con búsqueda del design system", () => {
    assert.match(lotsPage, /from "\.\.\/\.\.\/\.\.\/\.\.\/components\/design-system\/SearchableSelect"/);
    assert.match(lotsPage, /<SearchableSelect\s+id="inventory-lots-product"\s+label="Producto"/);
    assert.doesNotMatch(lotsPage, /<Select\s+label="Producto"/);
  });

  it("muestra los indicadores en la franja única de reportería (ReportSummary)", () => {
    assert.match(lotsPage, /from "\.\.\/\.\.\/\.\.\/\.\.\/components\/design-system\/ReportSummary"/);
    assert.match(lotsPage, /<ReportSummary\s+columns=\{6\}\s+ariaLabel="Indicadores del resultado"/);
    assert.doesNotMatch(lotsPage, /SummaryCard/);
    for (const label of ["Lotes activos", "Lotes vencidos", "Disponible vendible", "Disponible no vendible", "Discrep. críticas / altas"]) {
      assert.ok(lotsPage.includes(`label: "${label}"`), `falta indicador ${label}`);
    }
  });

  it("muestra Detalle como primera columna y Producto como segunda", () => {
    const headers = headerOrder(lotsPage);
    assert.equal(headers[0], "Detalle");
    assert.equal(headers[1], "Producto");
  });

  it("da nombre accesible al botón de detalle", () => {
    assert.match(lotsPage, /aria-label=\{`Ver detalle del lote \$\{row\.lot\.lotCode\} de \$\{identity\.name\}`\}/);
  });

  it("no consulta automáticamente: el estado vacío pide Buscar", () => {
    assert.match(lotsPage, /Presiona Buscar para consultar lotes y saldos\./);
    assert.match(lotsPage, /Filtros precargados desde Ubicaciones\. Presiona Buscar\./);
    assert.doesNotMatch(lotsPage, /useEffect\(\(\) => \{\s*void loadInventory/);
  });

  it("no muestra el UUID del producto en la tabla", () => {
    assert.doesNotMatch(lotsPage, /compactId/);
  });

  it("no silencia errores de conciliación", () => {
    assert.doesNotMatch(lotsPage, /\.catch\(\(\) => null\)/);
    assert.match(lotsPage, /No se pudo cargar la conciliación de lotes/);
  });

  it("expone los KPI vendible y no vendible", () => {
    assert.match(lotsPage, /label: "Disponible vendible"/);
    assert.match(lotsPage, /label: "Disponible no vendible"/);
  });

  it("no usa grillas de columnas fijas en filtros", () => {
    assert.doesNotMatch(lotsPage, /grid-cols-\[/);
  });

  it("solo usa operaciones de lectura", () => {
    assert.doesNotMatch(lotsPage, /method:\s*"(POST|PUT|PATCH|DELETE)"/);
    assert.doesNotMatch(lotsPage, /blockInventoryLot|cancelInventoryLot|updateInventoryLot/);
  });
});

describe("Inventario > Ubicaciones", () => {
  it("usa el panel colapsable y elimina la grilla rígida", () => {
    assert.match(locationsPage, /storageKey="inventory-locations"/);
    assert.doesNotMatch(locationsPage, /grid-cols-\[1fr_220px/);
  });

  it("muestra la sucursal legible en lugar del UUID", () => {
    assert.match(locationsPage, /Sucursal no disponible/);
    assert.doesNotMatch(locationsPage, /branchNameById\.get\(location\.branchId\) \?\? location\.branchId/);
  });

  it("ofrece Ver lotes, Reactivar y aviso de saldo al inactivar", () => {
    assert.match(locationsPage, /label: "Ver lotes"/);
    assert.match(locationsPage, /label: "Reactivar"/);
    assert.match(locationsPage, /updateInventoryLocation\(location\.id, \{ isActive: true \}\)/);
    assert.match(locationsPage, /listInventoryLotBalances\(\{[\s\S]*?onlyAvailable: true/);
  });

  it("Limpiar recarga cuando ya se había consultado", () => {
    assert.match(locationsPage, /const resetFilters = \(\) => \{[\s\S]*?if \(hasSearched\) \{\s*void loadLocations\(defaultFilters\);/);
  });
});

describe("Modal de lote", () => {
  it("muestra ubicaciones, compras y movimientos en el mismo modal", () => {
    assert.match(lotModal, /Ubicaciones de este lote/);
    assert.match(lotModal, /Compras de este lote/);
    assert.match(lotModal, /Movimientos del lote/);
    assert.match(lotModal, /getInventoryLotTraceability\(/);
  });

  it("no navega fuera de Lotes ni muestra identificadores técnicos", () => {
    assert.doesNotMatch(lotModal, /Ver compra|Ver ubicación|next\/link/);
    assert.doesNotMatch(lotModal, /Trazabilidad técnica/);
    assert.doesNotMatch(lotModal, /lotId:|balanceId:|productId:|purchaseItemId:/);
  });
});
