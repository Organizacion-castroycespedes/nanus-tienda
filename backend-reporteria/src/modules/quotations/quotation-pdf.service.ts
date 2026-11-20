import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ReportUser } from "../auth/report-auth.types";
import { ReportBranchScopeService } from "../auth/report-branch-scope.service";
import { DatabaseService } from "../database/database.service";
import { PdfmakeEngine } from "../pdf/pdfmake.engine";
import {
  buildQuotationPdfLayout,
  type QuotationPdfDataset,
  type QuotationPdfStatus,
} from "../pdf/templates/documents/quotation.template";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type QuotationHeaderRow = {
  id: string;
  tenant_id: string;
  branch_id: string;
  branch_name: string | null;
  code: string;
  effective_status: QuotationPdfStatus;
  issue_date: string | Date;
  validity_days: number;
  valid_until: string | Date;
  subtotal: string | number;
  discount_total: string | number;
  tax_total: string | number;
  total: string | number;
  commercial_terms: string | null;
  payment_delivery_terms: string | null;
  warranty_terms: string | null;
  notes: string | null;
  customer_name: string | null;
  customer_document: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  tenant_name: string;
  tenant_config: { logo?: string; logoUrl?: string; colors?: { primary?: string; secondary?: string } } | null;
  legal_name: string | null;
  nit: string | null;
  dv: string | null;
  company_address: string | null;
  company_city: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_website: string | null;
  representative_name: string | null;
  representative_document_type: string | null;
  representative_document_number: string | null;
};

type QuotationItemRow = {
  line_number: number;
  product_code: string | null;
  product_name: string;
  unit_code: string | null;
  quantity: string | number;
  final_unit_price: string | number;
  discount_percent: string | number;
  applied_promotion_name: string | null;
  tax_rate: string | number;
  tax_base: string | number;
  tax_amount: string | number;
  line_total: string | number;
  pricing_snapshot: { taxes?: unknown } | string | null;
};

const toNumber = (value: string | number | null | undefined) => Number(value ?? 0);
const round2 = (value: number) => Math.round((value + 1e-9) * 100) / 100;
const toDateOnly = (value: string | Date) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

@Injectable()
export class QuotationPdfService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ReportBranchScopeService) private readonly branchScope: ReportBranchScopeService,
    @Inject(PdfmakeEngine) private readonly pdfEngine: PdfmakeEngine
  ) {}

  /** Impuestos agrupados por nombre y tarifa desde el snapshot de cada linea (igual que la API). */
  summarizeTaxes(items: QuotationItemRow[]) {
    const groups = new Map<string, { taxName: string; taxRate: number; taxBase: number; taxAmount: number }>();
    for (const item of items) {
      const snapshot =
        typeof item.pricing_snapshot === "string"
          ? (JSON.parse(item.pricing_snapshot) as { taxes?: unknown })
          : item.pricing_snapshot;
      const taxes = Array.isArray(snapshot?.taxes) ? (snapshot!.taxes as Array<Record<string, unknown>>) : [];
      const effective =
        taxes.length > 0
          ? taxes.map((tax) => ({
              taxName: String(tax.taxName ?? "Impuesto"),
              taxRate: Number(tax.taxRate ?? 0),
              taxBase: Number(tax.taxBase ?? 0),
              taxAmount: Number(tax.taxAmount ?? 0),
            }))
          : toNumber(item.tax_amount) > 0
            ? [{ taxName: "IVA", taxRate: toNumber(item.tax_rate), taxBase: toNumber(item.tax_base), taxAmount: toNumber(item.tax_amount) }]
            : [];
      for (const tax of effective) {
        const key = `${tax.taxName}|${tax.taxRate}`;
        const group = groups.get(key) ?? { taxName: tax.taxName, taxRate: tax.taxRate, taxBase: 0, taxAmount: 0 };
        group.taxBase = round2(group.taxBase + tax.taxBase);
        group.taxAmount = round2(group.taxAmount + tax.taxAmount);
        groups.set(key, group);
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.taxRate - a.taxRate);
  }

  async getDataset(quotationId: string, user: ReportUser | undefined): Promise<QuotationPdfDataset> {
    if (!UUID.test(quotationId ?? "")) {
      throw new BadRequestException("quotation id is invalid");
    }
    const scope = await this.branchScope.resolve(user);

    const headerResult = await this.db.query<QuotationHeaderRow>(
      `
        SELECT
          q.id, q.tenant_id, q.branch_id, b.nombre AS branch_name, q.code,
          public.fnc_quotation_effective_status(q.status, q.valid_until) AS effective_status,
          q.issue_date, q.validity_days, q.valid_until,
          q.subtotal, q.discount_total, q.tax_total, q.total,
          q.commercial_terms, q.payment_delivery_terms, q.warranty_terms, q.notes,
          c.name AS customer_name, c.document_number AS customer_document, c.email AS customer_email,
          c.phone AS customer_phone, c.address AS customer_address,
          t.nombre AS tenant_name, t.config AS tenant_config,
          td.razon_social AS legal_name, td.nit, td.dv,
          td.direccion_principal AS company_address, td.ciudad AS company_city,
          td.telefono AS company_phone, td.email_corporativo AS company_email, td.sitio_web AS company_website,
          td.representante_nombre AS representative_name,
          td.representante_tipo_documento AS representative_document_type,
          td.representante_numero_documento AS representative_document_number
        FROM public.quotations q
        INNER JOIN public.tenants t ON t.id = q.tenant_id
        LEFT JOIN public.tenants_detalles td ON td.tenant_id = q.tenant_id
        LEFT JOIN public.customers c ON c.id = q.customer_id AND c.tenant_id = q.tenant_id
        LEFT JOIN public.tenant_branches b ON b.id = q.branch_id AND b.tenant_id = q.tenant_id
        WHERE q.id = $1 AND q.tenant_id = $2
        LIMIT 1
      `,
      [quotationId, scope.tenantId]
    );
    const header = headerResult.rows[0];
    if (!header) {
      throw new NotFoundException("quotation not found");
    }
    if (!scope.branchIds.includes(header.branch_id)) {
      throw new ForbiddenException("quotation branch is not authorized");
    }

    const itemsResult = await this.db.query<QuotationItemRow>(
      `
        SELECT line_number, product_code, product_name, unit_code, quantity, final_unit_price,
               discount_percent, applied_promotion_name, tax_rate, tax_base, tax_amount, line_total,
               pricing_snapshot
        FROM public.quotation_items
        WHERE quotation_id = $1 AND tenant_id = $2
        ORDER BY line_number
      `,
      [quotationId, scope.tenantId]
    );

    const config = header.tenant_config ?? {};
    return {
      quotation: {
        code: header.code,
        status: header.effective_status,
        issueDate: toDateOnly(header.issue_date),
        validUntil: toDateOnly(header.valid_until),
        validityDays: Number(header.validity_days),
        branchName: header.branch_name,
        subtotal: toNumber(header.subtotal),
        discountTotal: toNumber(header.discount_total),
        taxTotal: toNumber(header.tax_total),
        total: toNumber(header.total),
        commercialTerms: header.commercial_terms,
        paymentDeliveryTerms: header.payment_delivery_terms,
        warrantyTerms: header.warranty_terms,
        notes: header.notes,
      },
      customer: {
        name: header.customer_name ?? "Cliente",
        document: header.customer_document,
        email: header.customer_email,
        phone: header.customer_phone,
        address: header.customer_address,
      },
      items: itemsResult.rows.map((item) => ({
        lineNumber: Number(item.line_number),
        productCode: item.product_code,
        productName: item.product_name,
        unitCode: item.unit_code,
        quantity: toNumber(item.quantity),
        finalUnitPrice: toNumber(item.final_unit_price),
        discountPercent: toNumber(item.discount_percent),
        promotionName: item.applied_promotion_name,
        taxRate: toNumber(item.tax_rate),
        lineTotal: toNumber(item.line_total),
      })),
      taxes: this.summarizeTaxes(itemsResult.rows),
      company: {
        name: header.tenant_name,
        legalName: header.legal_name,
        nit: header.nit,
        dv: header.dv,
        address: header.company_address,
        city: header.company_city,
        phone: header.company_phone,
        email: header.company_email,
        website: header.company_website,
        representativeName: header.representative_name,
        representativeDocumentType: header.representative_document_type,
        representativeDocumentNumber: header.representative_document_number,
        logo: config.logo ?? config.logoUrl ?? null,
        primaryColor: config.colors?.primary ?? null,
        accentColor: config.colors?.secondary ?? null,
      },
    };
  }

  async getPdf(quotationId: string, user: ReportUser | undefined) {
    const dataset = await this.getDataset(quotationId, user);
    const buffer = await this.pdfEngine.generatePdf(buildQuotationPdfLayout(dataset));
    return { buffer, code: dataset.quotation.code };
  }
}
