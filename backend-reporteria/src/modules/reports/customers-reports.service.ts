import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import type { ReportUser } from "../auth/report-auth.types";
import { PdfmakeEngine } from "../pdf/pdfmake.engine";
import { buildCustomerMasterReportLayout } from "../pdf/templates/reports/customer-master-report.template";
import { buildCustomerOrdersStatusReportLayout } from "../pdf/templates/reports/customer-orders-status-report.template";
import { CustomersReportAdapter } from "./sql-adapters/customers-report.adapter";
import { DocumentExportService } from "./document-export.service";
import { SalesReportAdapter } from "./sql-adapters/sales-report.adapter";
import type {
  CustomerMasterDataset,
  CustomerMasterRow,
  CustomerOrdersStatusDataset,
  CustomerOrdersStatusRow,
  ReportActorContext,
} from "./types/customers-report.types";

type CustomersListQuery = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  customerDocument?: string;
  customerName?: string;
  format?: string;
};

const ROLE_PRIORITY = ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"];

@Injectable()
export class CustomersReportsService {
  constructor(
    @Inject(CustomersReportAdapter)
    private readonly customersReportAdapter: CustomersReportAdapter,
    @Inject(PdfmakeEngine)
    private readonly pdfEngine: PdfmakeEngine,
    @Inject(DocumentExportService)
    private readonly documentExport: DocumentExportService,
    @Inject(SalesReportAdapter)
    private readonly salesReportAdapter: SalesReportAdapter,
  ) {}

  private pickActorRole(roles: string[]): string {
    for (const role of ROLE_PRIORITY) {
      if (roles.some((item) => item.toUpperCase() === role)) {
        return role;
      }
    }

    return roles[0]?.toUpperCase() ?? "USER";
  }

  private resolveActor(user?: ReportUser): ReportActorContext {
    if (!user?.id || !user.tenantId) {
      throw new BadRequestException("report actor is required");
    }

    return {
      userId: user.id,
      role: this.pickActorRole(user.roles),
      tenantId: user.tenantId,
      branchId: user.branchId ?? null,
      email: user.email ?? null,
    };
  }

  private normalizeDate(value: string | undefined, endExclusive = false) {
    if (!value) {
      return undefined;
    }

    const normalized = value.trim();
    if (!normalized) {
      return undefined;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      const date = new Date(`${normalized}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime())) {
        throw new BadRequestException(`invalid date value: ${value}`);
      }

      if (endExclusive) {
        date.setUTCDate(date.getUTCDate() + 1);
      }

      return date.toISOString();
    }

    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`invalid date value: ${value}`);
    }

    return date.toISOString();
  }

  private toNumber(value: unknown) {
    return Number(value ?? 0);
  }

  private normalizeOptionalText(value: string | undefined) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private normalizeCustomerDocument(value: string | undefined) {
    const normalized = value?.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
    return normalized || undefined;
  }

  private normalizeCustomerRow(row: CustomerOrdersStatusRow): CustomerOrdersStatusRow {
    return {
      ...row,
      totalOrders: this.toNumber(row.totalOrders),
      pendingOrders: this.toNumber(row.pendingOrders),
      partialOrders: this.toNumber(row.partialOrders),
      completedOrders: this.toNumber(row.completedOrders),
      totalAmount: this.toNumber(row.totalAmount),
      totalPending: this.toNumber(row.totalPending),
    };
  }

  private normalizeCustomerOrdersStatusDataset(
    payload: CustomerOrdersStatusDataset | null,
    actor: ReportActorContext,
    query: CustomersListQuery
  ): CustomerOrdersStatusDataset {
    const filters = {
      tenantId: payload?.filters?.tenantId ?? query.tenantId ?? actor.tenantId,
      branchId: payload?.filters?.branchId ?? query.branchId ?? actor.branchId ?? null,
      dateFrom: payload?.filters?.dateFrom ?? this.normalizeDate(query.dateFrom) ?? null,
      dateTo: payload?.filters?.dateTo ?? this.normalizeDate(query.dateTo, true) ?? null,
      customerDocument:
        payload?.filters?.customerDocument ??
        this.normalizeOptionalText(query.customerDocument) ??
        null,
      customerName:
        payload?.filters?.customerName ?? this.normalizeOptionalText(query.customerName) ?? null,
      actorRole: payload?.filters?.actorRole ?? actor.role,
    };

    const rows = Array.isArray(payload?.rows)
      ? payload.rows.map((row) => this.normalizeCustomerRow(row))
      : [];

    return {
      filters,
      rows,
      summary: {
        count: this.toNumber(payload?.summary?.count ?? rows.length),
        totalOrders: this.toNumber(
          payload?.summary?.totalOrders ?? rows.reduce((sum, row) => sum + row.totalOrders, 0)
        ),
        pendingOrders: this.toNumber(
          payload?.summary?.pendingOrders ?? rows.reduce((sum, row) => sum + row.pendingOrders, 0)
        ),
        partialOrders: this.toNumber(
          payload?.summary?.partialOrders ?? rows.reduce((sum, row) => sum + row.partialOrders, 0)
        ),
        completedOrders: this.toNumber(
          payload?.summary?.completedOrders ??
            rows.reduce((sum, row) => sum + row.completedOrders, 0)
        ),
        totalAmount: this.toNumber(
          payload?.summary?.totalAmount ?? rows.reduce((sum, row) => sum + row.totalAmount, 0)
        ),
        totalPending: this.toNumber(
          payload?.summary?.totalPending ?? rows.reduce((sum, row) => sum + row.totalPending, 0)
        ),
      },
    };
  }

  async getCustomerOrdersStatus(query: CustomersListQuery, user?: ReportUser) {
    const actor = this.resolveActor(user);
    const payload = await this.customersReportAdapter.getCustomerOrdersStatus(actor, {
      tenantId: query.tenantId,
      branchId: query.branchId,
      dateFrom: this.normalizeDate(query.dateFrom),
      dateTo: this.normalizeDate(query.dateTo, true),
      customerDocument: this.normalizeOptionalText(query.customerDocument),
      customerName: this.normalizeOptionalText(query.customerName),
    });

    return this.normalizeCustomerOrdersStatusDataset(payload, actor, query);
  }

  async getCustomerOrdersStatusPdf(query: CustomersListQuery, user?: ReportUser) {
    const dataset = await this.getCustomerOrdersStatus(query, user);
    return this.pdfEngine.generatePdf(buildCustomerOrdersStatusReportLayout(dataset));
  }

  private normalizeMasterRow(row: CustomerMasterRow): CustomerMasterRow {
    return {
      ...row,
      taxResponsibilities: Array.isArray(row.taxResponsibilities) ? row.taxResponsibilities : [],
      isDianValidated: Boolean(row.isDianValidated),
      isActive: Boolean(row.isActive),
      isFinalConsumer: Boolean(row.isFinalConsumer),
    };
  }

  private async createCustomerMasterDataset(
    query: Pick<CustomersListQuery, "tenantId" | "customerDocument" | "customerName">,
    user?: ReportUser,
  ): Promise<CustomerMasterDataset> {
    const actor = this.resolveActor(user);
    const filters = {
      tenantId: query.tenantId,
      customerDocument: this.normalizeCustomerDocument(query.customerDocument),
      customerName: this.normalizeOptionalText(query.customerName),
    };
    const rows = await this.documentExport.collect(
      (client) => this.customersReportAdapter.getCustomerMasterCount(actor, filters, client),
      (client, offset, limit) => this.customersReportAdapter.getCustomerMasterBatch(actor, filters, client, offset, limit),
    );

    return {
      filters: {
        tenantId: filters.tenantId ?? actor.tenantId,
        customerDocument: filters.customerDocument ?? null,
        customerName: filters.customerName ?? null,
        actorRole: actor.role,
      },
      summary: { count: rows.length },
      rows: rows.map((row) => this.normalizeMasterRow(row)),
      branding: await this.salesReportAdapter.getPrintableCompany(actor),
    };
  }

  async getCustomerMaster(query: CustomersListQuery, user?: ReportUser) {
    return this.createCustomerMasterDataset(query, user);
  }

  async getCustomerMasterPdf(query: CustomersListQuery, user?: ReportUser) {
    const dataset = await this.createCustomerMasterDataset(query, user);
    return this.pdfEngine.generatePdf(buildCustomerMasterReportLayout(dataset));
  }

  async getCustomerMasterExcel(query: CustomersListQuery, user?: ReportUser) {
    const dataset = await this.createCustomerMasterDataset(query, user);
    return this.buildCustomerMasterExcel(dataset);
  }

  private async buildCustomerMasterExcel(dataset: CustomerMasterDataset) {
    const workbook = new ExcelJS.Workbook();
    const info = workbook.addWorksheet("Resumen");
    info.addRows([
      [dataset.branding.legalName ?? dataset.branding.tenantName ?? ""],
      [dataset.branding.nit ? `NIT ${dataset.branding.nit}` : ""],
      [dataset.branding.address ?? ""],
      [dataset.branding.phone ?? "", dataset.branding.email ?? ""],
      ["Reporte", "Clientes"],
      ["Clientes", dataset.summary.count],
      ["Documento", dataset.filters.customerDocument ?? ""],
      ["Nombre", dataset.filters.customerName ?? ""],
    ]);
    info.getColumn(1).width = 28;
    info.getColumn(2).width = 44;

    const sheet = workbook.addWorksheet("Clientes", { views: [{ state: "frozen", ySplit: 1 }] });
    const columns: Array<[string, string, number]> = [
      ["Cliente ID", "customerId", 38], ["Nombre", "name", 28], ["Razón social", "legalName", 28],
      ["Nombre comercial", "tradeName", 28], ["Tipo documento", "documentType", 16], ["Número documento", "documentNumber", 22],
      ["Número normalizado", "documentNumberNormalized", 22], ["DV", "verificationDigit", 10], ["Teléfono", "phone", 18],
      ["Correo", "email", 28], ["Correo fiscal", "fiscalEmail", 28], ["Correo factura", "invoiceEmail", 28],
      ["Dirección", "address", 32], ["Ciudad", "city", 20], ["Municipio código", "municipalityCode", 16],
      ["Departamento", "department", 22], ["Departamento código", "departmentCode", 18], ["País", "country", 20],
      ["País código", "countryCode", 12], ["Tipo persona", "personType", 16], ["Régimen", "taxRegime", 18],
      ["Responsabilidades", "taxResponsibilities", 30], ["Estado fiscal", "fiscalStatus", 18], ["Validado DIAN", "isDianValidated", 15],
      ["Fuente fiscal", "fiscalDataSource", 18], ["Última consulta DIAN", "dianLastLookupAt", 22], ["Estado consulta DIAN", "dianLastLookupStatus", 22],
      ["Activo", "isActive", 12], ["Consumidor final", "isFinalConsumer", 16], ["Creado", "createdAt", 22], ["Actualizado", "updatedAt", 22],
    ];
    sheet.columns = columns.map(([header, key, width]) => ({ header, key, width }));
    dataset.rows.forEach((row) => sheet.addRow({
      ...row,
      documentType: row.dianIdentificationType ?? row.documentTypeCode ?? "",
      taxResponsibilities: row.taxResponsibilities.join(", "),
      dianLastLookupAt: row.dianLastLookupAt ? new Date(row.dianLastLookupAt) : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    }));
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    ["dianLastLookupAt", "createdAt", "updatedAt"].forEach((key) => {
      sheet.getColumn(key).numFmt = "yyyy-mm-dd hh:mm";
    });
    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }
}
