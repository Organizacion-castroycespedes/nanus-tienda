import type { TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { CustomerMasterDataset } from "../../../reports/types/customers-report.types";

const value = (item: string | null | undefined) => item?.trim() || "-";

const logoCell = (logo: string | null) => {
  if (!logo || !/^data:image\/(png|jpeg|jpg|svg\+xml);base64,/i.test(logo)) {
    return { width: 1, text: "" };
  }
    return { width: 72, image: logo, fit: [68, 38] as [number, number] };
};

export const buildCustomerMasterReportLayout = (
  dataset: CustomerMasterDataset,
): TDocumentDefinitions => ({
  pageSize: "A4",
  pageOrientation: "landscape",
  pageMargins: [28, 28, 28, 30],
  content: [
    {
      columns: [
        logoCell(dataset.branding.logo),
        {
          width: "*",
          stack: [
            { text: value(dataset.branding.legalName ?? dataset.branding.tenantName), style: "title" },
            { text: dataset.branding.nit ? `NIT ${dataset.branding.nit}` : "", style: "meta" },
            { text: [value(dataset.branding.address), value(dataset.branding.city)], style: "meta" },
            { text: [value(dataset.branding.phone), value(dataset.branding.email)], style: "meta" },
          ],
        },
        {
          width: 190,
          stack: [
            { text: "Reporte de clientes", style: "title", alignment: "right" },
            { text: `Clientes: ${dataset.summary.count}`, style: "meta", alignment: "right" },
            { text: `Tenant: ${value(dataset.branding.tenantName)}`, style: "meta", alignment: "right" },
            { text: `Generado: ${new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date())}`, style: "meta", alignment: "right" },
          ],
        },
      ],
      margin: [0, 0, 0, 14],
    },
    {
      text: `Filtro documento: ${value(dataset.filters.customerDocument)} | Filtro nombre: ${value(dataset.filters.customerName)}`,
      style: "meta",
      margin: [0, 0, 0, 10],
    },
    {
      table: {
        headerRows: 1,
        widths: ["*", 70, 105, 88, 150, 82, 65],
        dontBreakRows: true,
        keepWithHeaderRows: 1,
        body: [
          ["Cliente", "Tipo", "Número documento", "Teléfono", "Correo", "Estado fiscal", "Estado"].map(
            (text) => ({ text, style: "tableHeader" }),
          ),
          ...dataset.rows.map((row) => [
            { text: value(row.legalName ?? row.tradeName ?? row.name) },
            { text: value(row.dianIdentificationType ?? row.documentTypeCode), alignment: "center" },
            { text: value(row.identificationNumber ?? row.documentNumber) },
            { text: value(row.phone) },
            { text: value(row.email ?? row.fiscalEmail ?? row.invoiceEmail) },
            { text: value(row.fiscalStatus), alignment: "center" },
            { text: row.isActive ? "Activo" : "Inactivo", alignment: "center" },
          ] as TableCell[]),
        ],
      },
      layout: "lightHorizontalLines",
    },
  ],
  footer: (currentPage, pageCount) => ({
    text: `Página ${currentPage} de ${pageCount} · Manus POS`,
    alignment: "center",
    style: "footer",
  }),
  styles: {
    title: { fontSize: 13, bold: true },
    meta: { fontSize: 8, color: "#64748b", margin: [0, 2, 0, 0] },
    tableHeader: { bold: true, fillColor: "#e2e8f0", fontSize: 8 },
    footer: { fontSize: 8, color: "#64748b" },
  },
  defaultStyle: { font: "Roboto", fontSize: 8 },
});
