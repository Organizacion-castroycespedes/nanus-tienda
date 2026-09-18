import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { ProductInventoryDataset, ProductInventoryRow } from "../../../reports/product-inventory-reports.service";

const titleByPreset = {
  GENERAL: "Productos e inventario",
  PHYSICAL_COUNT: "Conteo fisico de inventario",
  LOTS_EXPIRATIONS: "Lotes y vencimientos",
};

const text = (value: string | number | null | undefined) => value == null ? "-" : String(value);

export const buildProductInventoryLayout = (dataset: ProductInventoryDataset): TDocumentDefinitions => {
  const accent = /^#[0-9a-f]{6}$/i.test(dataset.branding.primaryColor ?? "")
    ? dataset.branding.primaryColor! : "#334155";
  const logo = dataset.branding.logo;
  let printableLogo: Content = { text: "" };
  if (logo && /^data:image\/(png|jpeg);base64,/i.test(logo)) {
    printableLogo = { image: logo, width: 56, height: 42 };
  } else if (logo && /^data:image\/svg\+xml;base64,/i.test(logo)) {
    const svg = Buffer.from(logo.split(",", 2)[1], "base64").toString("utf8");
    if (svg.includes("<svg")) printableLogo = { svg, width: 56, height: 42 };
  }
  const lots = dataset.preset === "LOTS_EXPIRATIONS";
  const physical = dataset.preset === "PHYSICAL_COUNT";
  const headings = lots
    ? ["Producto / SKU", "Sucursal", "Lote", "Vence", "Dias", "En lote", "Reservado", "Disponible", "Ubicacion"]
    : physical
      ? ["Producto / SKU", "Sucursal", "Unidad", "Cod. principal", "Stock sistema", "Conteo fisico", "Diferencia", "Observaciones"]
      : ["Producto / SKU", "Sucursal", "Categoria", "Cod. principal", "Precio", "Costo catalogo", "Stock general*", "Estado", "Lote / Vence"];
  const rows = dataset.rows.filter((row) => !lots || row.lotId !== null);
  const map = (row: ProductInventoryRow): TableCell[] => lots
    ? [text(`${row.productName}\n${row.sku}`), row.branchName, text(row.lotCode),
        text(row.expirationDate), text(row.daysToExpiration), text(row.quantityOnHand),
        text(row.quantityReserved), text(row.quantityAvailable), text(row.locationName)]
    : physical
      ? [text(`${row.productName}\n${row.sku}`), row.branchName,
          row.unitAbbreviation, text(row.primaryCode), text(row.stock), "", "", ""]
      : [text(`${row.productName}\n${row.sku}`), row.branchName,
          text(row.categoryName), text(row.primaryCode), text(row.price),
          text(row.catalogCost), text(row.stock), row.stockState,
          text(row.lotCode ? `${row.lotCode} / ${row.expirationDate ?? "-"}` : null)];
  const filters = Object.entries(dataset.filters)
    .filter(([key]) => key !== "preset")
    .map(([key, value]) => `${key}: ${value}`).join("  |  ");
  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [28, 30, 28, 32],
    content: [
      {
        columns: [
          printableLogo,
          { width: "*", stack: [
            { text: dataset.branding.name, style: "company" },
            { text: dataset.branding.legalName ?? "", style: "meta" },
            { text: [dataset.branding.nit ? `NIT ${dataset.branding.nit}` : "",
              dataset.branding.address ?? "", dataset.branding.phone ?? ""].filter(Boolean).join("  |  "), style: "meta" },
          ] },
        ], margin: [0, 0, 0, 12],
      },
      { text: titleByPreset[dataset.preset], style: "title", color: accent },
      { text: `Generado: ${dataset.generatedAt}  |  Usuario: ${dataset.generatedBy}  |  Sucursales autorizadas: ${dataset.branchIds.length}`, style: "meta" },
      { text: filters || "Sin filtros adicionales", style: "meta", margin: [0, 2, 0, 8] },
      { text: `Filas de detalle: ${rows.length}`, style: "meta", margin: [0, 0, 0, 8] },
      {
        table: {
          headerRows: 1,
          widths: physical ? ["*", 70, 42, 70, 54, 62, 58, 80]
            : lots ? ["*", 62, 62, 58, 30, 48, 48, 48, 65]
              : ["*", 65, 75, 72, 49, 58, 56, 62, 70],
          body: [headings.map((heading) => ({ text: heading, style: "header" })) as TableCell[],
            ...rows.map(map),
            ...(rows.length ? [] : [[{ text: "No hay productos para estos filtros", colSpan: headings.length },
              ...Array(headings.length - 1).fill("")] as TableCell[]])],
        },
        layout: "lightHorizontalLines",
      },
      { text: "* El stock general se repite en las filas de lote o ubicacion; no sumar esas filas para obtener existencias.",
        style: "meta", margin: [0, 10, 0, 0] },
      ...(physical ? [{ text: "El conteo fisico, la diferencia y las observaciones son campos manuales. Este documento no ajusta inventario.",
        style: "meta", margin: [0, 4, 0, 0] as [number, number, number, number] }] : []),
    ],
    footer: (page, total) => ({ text: `Manus POS  |  ${page} / ${total}`, alignment: "right",
      margin: [0, 0, 28, 0], fontSize: 8, color: "#475569" }),
    styles: {
      company: { fontSize: 12, bold: true },
      title: { fontSize: 16, bold: true, margin: [0, 0, 0, 5] },
      meta: { fontSize: 8, color: "#475569" },
      header: { bold: true, fillColor: "#e2e8f0", color: "#0f172a" },
    },
    defaultStyle: { font: "Roboto", fontSize: 8 },
  };
};
