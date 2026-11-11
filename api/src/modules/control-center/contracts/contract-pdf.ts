import { formatPesos } from "../alerts/alert-email";
import type { ContractClause } from "./contract-terms";

export type PdfIssuer = {
  name: string;
  taxId: string | null;
  dv: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoDataUrl: string | null;
};

export type PdfItem = {
  itemType: string;
  description: string;
  quantity: string;
  unitAmount: string;
  billingFrequency: string;
  discountAmount: string;
};

export type PdfTotals = Partial<Record<string, { subtotal: string; base: string; tax: string; total: string }>>;

export type ContractPdfInput = {
  issuedOn: string;
  issuer: PdfIssuer;
  contract: {
    number: string;
    status: string;
    startDate: string;
    endDate: string | null;
    planName: string;
    tenantName: string;
  };
  account: {
    legalName: string;
    taxIdType: string;
    taxId: string;
    dv: string | null;
    billingEmail: string;
    contactName: string | null;
    contactPhone: string | null;
    address: string | null;
    city: string | null;
  };
  version: {
    versionNo: number;
    effectiveFrom: string;
    effectiveTo: string | null;
    termPhase: string;
    billingFrequency: string;
    billingAnchorDay: number;
    trialEndsOn: string | null;
    prorationPolicy: string;
    taxName: string;
    taxRate: string;
    pricesIncludeTax: boolean;
    includedPosTerminals: number;
    contractedPosTerminals: number;
    items: PdfItem[];
    totals: PdfTotals;
    reason: string | null;
  };
  clauses: ContractClause[];
};

const STATUS = { DRAFT: "Borrador", ACTIVE: "Activo", ENDED: "Terminado", CANCELLED: "Cancelado" } as Record<string, string>;
const PHASE = { INITIAL: "Término inicial", RENEWAL: "Renovación" } as Record<string, string>;
const FREQUENCY = { MONTHLY: "Mensual", ANNUAL: "Anual", ONE_TIME: "Pago único" } as Record<string, string>;
const ORDINALS = ["PRIMERA", "SEGUNDA", "TERCERA", "CUARTA", "QUINTA", "SEXTA", "SÉPTIMA", "OCTAVA", "NOVENA", "DÉCIMA", "UNDÉCIMA", "DUODÉCIMA"];

export const formatDay = (date: string | null | undefined) =>
  date ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}` : "—";

export const formatRate = (rate: string) => {
  const [integer, fraction = ""] = String(rate).split(".");
  const basis = Number(integer) * 10000 + Number((fraction + "0000").slice(0, 4));
  const percent = basis / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
};

const quantityText = (quantity: string) => {
  const [integer, fraction = "00"] = String(quantity).split(".");
  return /^0*$/.test(fraction) ? integer : `${integer},${fraction.replace(/0+$/, "")}`;
};

const lineTotal = (item: PdfItem) => {
  const cents = (value: string) => {
    const [i, f = ""] = String(value).split(".");
    return BigInt(i) * 100n + BigInt((f + "00").slice(0, 2));
  };
  const gross = (cents(item.quantity) * cents(item.unitAmount) + 50n) / 100n;
  const net = gross - cents(item.discountAmount);
  return `${net / 100n}.${String(net % 100n).padStart(2, "0")}`;
};

/** Nombre del impuesto con su tasa, sin repetirla si el nombre ya la incluye ("IVA 19%"). */
export const taxLabel = (name: string, rate: string) => {
  const formatted = formatRate(rate);
  return name.includes(formatted) ? name : `${name} ${formatted}`;
};

const idText = (type: string, number: string | null, dv: string | null) =>
  number ? `${type} ${number}${dv ? `-${dv}` : ""}` : "—";

const labelValue = (rows: [string, string][]) => ({
  table: {
    widths: [150, "*"],
    body: rows.map(([label, value]) => [{ text: label, style: "label" }, { text: value || "—" }]),
  },
  layout: "lightHorizontalLines",
});

export const issuerIdText = (issuer: PdfIssuer) => (issuer.taxId ? `NIT ${issuer.taxId}${issuer.dv ? `-${issuer.dv}` : ""}` : "");

/** Encabezado con logo (o nombre) y datos del emisor; compartido por el contrato y el estado de cuenta. */
export const issuerHeader = (issuer: PdfIssuer) => {
  const issuerLines = [
    issuerIdText(issuer) || null,
    [issuer.address, issuer.city].filter(Boolean).join(", ") || null,
    [issuer.phone, issuer.email].filter(Boolean).join(" · ") || null,
    issuer.website,
  ].filter((line): line is string => Boolean(line));
  return {
    columns: [
      issuer.logoDataUrl
        ? { image: issuer.logoDataUrl, fit: [190, 70], width: 200 }
        : { text: issuer.name, style: "issuerName", width: 200 },
      {
        width: "*",
        alignment: "right",
        stack: [{ text: issuer.name, bold: true }, ...issuerLines.map((line) => ({ text: line, style: "small" }))],
      },
    ],
    margin: [0, 0, 0, 16],
  };
};

/** Estilos comunes de los documentos del Control Center. */
export const PDF_STYLES = {
  issuerName: { fontSize: 16, bold: true },
  title: { fontSize: 15, bold: true, alignment: "center", margin: [0, 0, 0, 4] },
  subtitle: { fontSize: 9, alignment: "center", color: "#475569", margin: [0, 0, 0, 14] },
  section: { fontSize: 11, bold: true, color: "#1e3a8a", margin: [0, 12, 0, 6] },
  label: { color: "#475569" },
  small: { fontSize: 8.5, color: "#334155" },
  tableHeader: { bold: true, fillColor: "#e2e8f0" },
  clauseTitle: { bold: true, margin: [0, 8, 0, 2] },
  clause: { alignment: "justify", margin: [0, 0, 0, 4] },
};

/** Definición pdfmake del contrato (función pura, sin acceso a datos). */
export const buildContractDocument = (input: ContractPdfInput): Record<string, unknown> => {
  const { issuer, contract, account, version } = input;
  const header = issuerHeader(issuer);

  const itemRows = version.items.map((item) => [
    item.description,
    FREQUENCY[item.billingFrequency] ?? item.billingFrequency,
    { text: quantityText(item.quantity), alignment: "right" },
    { text: formatPesos(String(item.unitAmount)), alignment: "right" },
    { text: Number(String(item.discountAmount).split(".")[0]) > 0 ? `- ${formatPesos(String(item.discountAmount))}` : "—", alignment: "right" },
    { text: formatPesos(lineTotal(item)), alignment: "right", bold: true },
  ]);

  const totalsRows = Object.entries(version.totals)
    .filter(([, value]) => Boolean(value))
    .map(([frequency, value]) => [
      FREQUENCY[frequency] ?? frequency,
      { text: formatPesos(value!.base), alignment: "right" },
      { text: formatPesos(value!.tax), alignment: "right" },
      { text: formatPesos(value!.total), alignment: "right", bold: true },
    ]);

  const clauses = input.clauses.flatMap((clause, index) => [
    { text: `${ORDINALS[index] ?? `${index + 1}.`} – ${clause.title.toUpperCase()}`, style: "clauseTitle" },
    ...clause.paragraphs.map((paragraph) => ({ text: paragraph, style: "clause" })),
  ]);

  return {
    pageSize: "LETTER",
    pageMargins: [48, 48, 48, 56],
    info: { title: `Contrato ${contract.number} v${version.versionNo}`, author: issuer.name, subject: "Contrato de licencia de uso de MANUS POS" },
    ...(contract.status === "DRAFT" ? { watermark: { text: "BORRADOR", color: "#b91c1c", opacity: 0.12, bold: true } } : {}),
    defaultStyle: { font: "Helvetica", fontSize: 9.5, lineHeight: 1.2, color: "#0f172a" },
    styles: PDF_STYLES,
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `${issuer.name} · Contrato ${contract.number} v${version.versionNo}`, style: "small" },
        { text: `Página ${currentPage} de ${pageCount}`, alignment: "right", style: "small" },
      ],
      margin: [48, 16, 48, 0],
    }),
    content: [
      header,
      { text: "CONTRATO DE LICENCIA DE USO DE MANUS POS", style: "title" },
      {
        text: `Contrato ${contract.number} · Versión ${version.versionNo} · ${STATUS[contract.status] ?? contract.status} · Emitido el ${formatDay(input.issuedOn)}`,
        style: "subtitle",
      },
      { text: "1. Partes", style: "section" },
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "EL PRESTADOR", bold: true },
              { text: issuer.name },
              { text: issuer.taxId ? `NIT ${issuer.taxId}${issuer.dv ? `-${issuer.dv}` : ""}` : "—", style: "small" },
              { text: [issuer.address, issuer.city].filter(Boolean).join(", ") || "—", style: "small" },
              { text: [issuer.phone, issuer.email].filter(Boolean).join(" · ") || "—", style: "small" },
            ],
          },
          {
            width: "*",
            stack: [
              { text: "EL CLIENTE", bold: true },
              { text: account.legalName },
              { text: idText(account.taxIdType, account.taxId, account.dv), style: "small" },
              { text: [account.address, account.city].filter(Boolean).join(", ") || "—", style: "small" },
              { text: [account.contactName, account.contactPhone, account.billingEmail].filter(Boolean).join(" · "), style: "small" },
            ],
          },
        ],
        columnGap: 24,
      },
      { text: "2. Condiciones del servicio", style: "section" },
      labelValue([
        ["Plan", contract.planName],
        ["Tenant (empresa en MANUS)", contract.tenantName],
        ["Condición", `${PHASE[version.termPhase] ?? version.termPhase} · facturación ${(FREQUENCY[version.billingFrequency] ?? version.billingFrequency).toLowerCase()}`],
        ["Inicio del contrato", formatDay(contract.startDate)],
        ["Vigencia de esta versión", `${formatDay(version.effectiveFrom)} – ${version.effectiveTo ? formatDay(version.effectiveTo) : "indefinida"}`],
        ["Período de prueba", version.trialEndsOn ? `Hasta el ${formatDay(version.trialEndsOn)}; la facturación inicia ese día` : "Sin período de prueba"],
        ["Día de corte", `Día ${version.billingAnchorDay} de cada período (o el último día del mes si no existe)`],
        ["Prorrateo por cambios", version.prorationPolicy === "DAILY" ? "Diario, proporcional a los días restantes" : "Sin prorrateo; los cambios rigen desde el siguiente período"],
        ["Terminales POS", `${version.contractedPosTerminals} contratada(s) (${version.includedPosTerminals} incluida(s) en el plan)`],
        ["Impuesto", `${taxLabel(version.taxName, version.taxRate)} ${version.pricesIncludeTax ? "incluido en los precios" : "adicional a los precios"}`],
        ...(contract.endDate ? [["Terminación", formatDay(contract.endDate)] as [string, string]] : []),
      ]),
      { text: "3. Conceptos y valores", style: "section" },
      {
        table: {
          headerRows: 1,
          widths: ["*", 60, 34, 70, 70, 74],
          body: [
            [
              { text: "Concepto", style: "tableHeader" },
              { text: "Frecuencia", style: "tableHeader" },
              { text: "Cant.", style: "tableHeader", alignment: "right" },
              { text: "Valor unitario", style: "tableHeader", alignment: "right" },
              { text: "Descuento", style: "tableHeader", alignment: "right" },
              { text: "Total", style: "tableHeader", alignment: "right" },
            ],
            ...itemRows,
          ],
        },
        layout: "lightHorizontalLines",
      },
      totalsRows.length > 0
        ? {
            margin: [0, 10, 0, 0],
            columns: [
              { width: "*", text: "" },
              {
                width: 300,
                table: {
                  headerRows: 1,
                  widths: ["*", 70, 70, 74],
                  body: [
                    [
                      { text: "Período", style: "tableHeader" },
                      { text: "Base", style: "tableHeader", alignment: "right" },
                      { text: version.taxName, style: "tableHeader", alignment: "right" },
                      { text: "Total", style: "tableHeader", alignment: "right" },
                    ],
                    ...totalsRows,
                  ],
                },
                layout: "lightHorizontalLines",
              },
            ],
          }
        : { text: "" },
      { text: "4. Cláusulas", style: "section" },
      ...clauses,
      {
        text: "En constancia, las partes firman este documento.",
        margin: [0, 14, 0, 36],
      },
      {
        unbreakable: true,
        columns: [
          {
            width: "*",
            stack: [
              { canvas: [{ type: "line", x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.8 }] },
              { text: "EL PRESTADOR", bold: true, margin: [0, 4, 0, 0] },
              { text: issuer.name, style: "small" },
              { text: issuer.taxId ? `NIT ${issuer.taxId}${issuer.dv ? `-${issuer.dv}` : ""}` : "", style: "small" },
            ],
          },
          {
            width: "*",
            stack: [
              { canvas: [{ type: "line", x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.8 }] },
              { text: "EL CLIENTE", bold: true, margin: [0, 4, 0, 0] },
              { text: account.legalName, style: "small" },
              { text: idText(account.taxIdType, account.taxId, account.dv), style: "small" },
            ],
          },
        ],
        columnGap: 40,
      },
    ],
  };
};

export const contractPdfFileName = (contractNumber: string, versionNo: number) =>
  `${contractNumber.replace(/[^A-Za-z0-9-]/g, "_")}-v${versionNo}.pdf`;

/** Solo se acepta un logo PNG o JPEG embebido (data URL) de hasta 2 MB; las URL externas no se descargan. */
export const embeddedLogo = (logo: string | null | undefined) =>
  typeof logo === "string" && /^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=\s]+$/.test(logo) && logo.length <= 2_800_000 ? logo : null;

/** Renderiza la definición con pdfmake y las fuentes estándar Helvetica (sin archivos de fuentes). */
export const renderPdf = (definition: Record<string, unknown>): Promise<Buffer> => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PdfPrinter = require("pdfmake");
  const printer = new PdfPrinter({
    Helvetica: { normal: "Helvetica", bold: "Helvetica-Bold", italics: "Helvetica-Oblique", bolditalics: "Helvetica-BoldOblique" },
  });
  const document = printer.createPdfKitDocument(definition);
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.end();
  });
};

type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

/** Emisor: empresa del tenant plataforma registrada en MANUS (datos de empresa y logo de la marca). */
export const loadIssuer = async (db: Queryable, platformTenantId: string): Promise<PdfIssuer> => {
  const result = await db.query(
    `SELECT t.nombre, t.config->>'logo' AS logo, td.razon_social, td.nit, td.dv, td.direccion_principal,
            COALESCE(m.nombre, td.ciudad) AS ciudad, td.telefono, td.email_corporativo, td.sitio_web
     FROM public.tenants t
     LEFT JOIN public.tenants_detalles td ON td.tenant_id = t.id
     LEFT JOIN public.municipios m ON m.id = td.municipio_id
     WHERE t.id = $1`,
    [platformTenantId],
  );
  const issuer = result.rows[0] ?? {};
  return {
    name: issuer.razon_social ?? issuer.nombre ?? "MANUS POS",
    taxId: issuer.nit ?? null,
    dv: issuer.dv ?? null,
    address: issuer.direccion_principal ?? null,
    city: issuer.ciudad ?? null,
    phone: issuer.telefono ?? null,
    email: issuer.email_corporativo ?? null,
    website: issuer.sitio_web ?? null,
    logoDataUrl: embeddedLogo(issuer.logo),
  };
};
