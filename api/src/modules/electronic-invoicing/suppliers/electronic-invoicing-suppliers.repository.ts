import { Inject, Injectable } from "@nestjs/common";
import type { QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import type {
  CreateElectronicInvoicingSupplierInput,
  ElectronicInvoicingSupplier,
  ListElectronicInvoicingSuppliersFilters,
  UpdateElectronicInvoicingSupplierInput,
} from "./electronic-invoicing-supplier.types";

type SupplierRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  name: string;
  document_number: string | null;
  document_type_code: string | null;
  document_number_normalized: string | null;
  dian_identification_type: string | null;
  identification_number: string | null;
  verification_digit: string | null;
  legal_name: string | null;
  trade_name: string | null;
  fiscal_email: string | null;
  invoice_email: string | null;
  phone: string | null;
  address: string | null;
  country_code: string | null;
  department_code: string | null;
  municipality_code: string | null;
  person_type: ElectronicInvoicingSupplier["personType"];
  tax_regime: string | null;
  tax_responsibilities: string[] | null;
  fiscal_status: ElectronicInvoicingSupplier["fiscalStatus"];
  fiscal_provider: string | null;
  fiscal_data_source: ElectronicInvoicingSupplier["fiscalDataSource"];
  is_dian_validated: boolean;
  fiscal_last_lookup_at: string | Date | null;
  fiscal_last_lookup_status: ElectronicInvoicingSupplier["fiscalLastLookupStatus"];
  dian_metadata: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string | Date;
  updated_at: string | Date;
};

const hasOwn = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

const supplierSelect = `
  id,
  tenant_id,
  name,
  document_number,
  document_type_code,
  document_number_normalized,
  dian_identification_type,
  identification_number,
  verification_digit,
  legal_name,
  trade_name,
  fiscal_email,
  invoice_email,
  phone,
  address,
  country_code,
  department_code,
  municipality_code,
  person_type,
  tax_regime,
  tax_responsibilities,
  fiscal_status,
  fiscal_provider,
  fiscal_data_source,
  is_dian_validated,
  fiscal_last_lookup_at,
  fiscal_last_lookup_status,
  dian_metadata,
  is_active,
  created_at,
  updated_at
`;

@Injectable()
export class ElectronicInvoicingSuppliersRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService
  ) {}

  private mapRow(row: SupplierRow): ElectronicInvoicingSupplier {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      documentNumber: row.document_number,
      documentTypeCode: row.document_type_code,
      documentNumberNormalized: row.document_number_normalized,
      dianIdentificationType: row.dian_identification_type,
      identificationNumber: row.identification_number,
      verificationDigit: row.verification_digit,
      legalName: row.legal_name,
      tradeName: row.trade_name,
      fiscalEmail: row.fiscal_email,
      invoiceEmail: row.invoice_email,
      phone: row.phone,
      address: row.address,
      countryCode: row.country_code,
      departmentCode: row.department_code,
      municipalityCode: row.municipality_code,
      personType: row.person_type,
      taxRegime: row.tax_regime,
      taxResponsibilities: Array.isArray(row.tax_responsibilities)
        ? row.tax_responsibilities
        : [],
      fiscalStatus: row.fiscal_status,
      fiscalProvider: row.fiscal_provider,
      fiscalDataSource: row.fiscal_data_source,
      isDianValidated: row.is_dian_validated,
      fiscalLastLookupAt: row.fiscal_last_lookup_at
        ? new Date(row.fiscal_last_lookup_at)
        : null,
      fiscalLastLookupStatus: row.fiscal_last_lookup_status,
      dianMetadata: row.dian_metadata ?? {},
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async listByTenant(
    tenantId: string,
    filters: ListElectronicInvoicingSuppliersFilters = {}
  ): Promise<ElectronicInvoicingSupplier[]> {
    const clauses = ["tenant_id = $1"];
    const params: unknown[] = [tenantId];

    if (filters.search?.trim()) {
      params.push(`%${filters.search.trim()}%`);
      clauses.push(
        `(name ILIKE $${params.length} OR legal_name ILIKE $${params.length} OR trade_name ILIKE $${params.length} OR document_number ILIKE $${params.length})`
      );
    }

    if (filters.documentTypeCode?.trim()) {
      params.push(filters.documentTypeCode.trim());
      clauses.push(
        `COALESCE(dian_identification_type, document_type_code) = $${params.length}`
      );
    }

    if (filters.documentNumber?.trim()) {
      params.push(`%${filters.documentNumber.trim()}%`);
      clauses.push(
        `(document_number ILIKE $${params.length} OR document_number_normalized ILIKE $${params.length} OR identification_number ILIKE $${params.length})`
      );
    }

    if (filters.isDianValidated !== undefined) {
      params.push(filters.isDianValidated);
      clauses.push(`is_dian_validated = $${params.length}`);
    }

    if (filters.fiscalDataSource) {
      params.push(filters.fiscalDataSource);
      clauses.push(`fiscal_data_source = $${params.length}`);
    }

    if (filters.fiscalStatus) {
      params.push(filters.fiscalStatus);
      clauses.push(`fiscal_status = $${params.length}`);
    }

    if (filters.isActive !== undefined) {
      params.push(filters.isActive);
      clauses.push(`is_active = $${params.length}`);
    }

    const result = await this.db.query<SupplierRow>(
      `
        SELECT ${supplierSelect}
        FROM suppliers
        WHERE ${clauses.join(" AND ")}
        ORDER BY created_at DESC
      `,
      params
    );

    return (result.rows ?? []).map((row) => this.mapRow(row));
  }

  async findById(
    id: string,
    tenantId: string
  ): Promise<ElectronicInvoicingSupplier | null> {
    const result = await this.db.query<SupplierRow>(
      `
        SELECT ${supplierSelect}
        FROM suppliers
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
      `,
      [id, tenantId]
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByFiscalIdentity(
    tenantId: string,
    documentTypeCode: string,
    identificationNumber: string,
    excludeSupplierId?: string
  ): Promise<ElectronicInvoicingSupplier | null> {
    const params: unknown[] = [tenantId, documentTypeCode, identificationNumber];
    const clauses = [
      "tenant_id = $1",
      "COALESCE(dian_identification_type, document_type_code) = $2",
      "COALESCE(identification_number, document_number_normalized) = $3",
    ];

    if (excludeSupplierId) {
      params.push(excludeSupplierId);
      clauses.push(`id <> $${params.length}`);
    }

    const result = await this.db.query<SupplierRow>(
      `
        SELECT ${supplierSelect}
        FROM suppliers
        WHERE ${clauses.join(" AND ")}
        LIMIT 1
      `,
      params
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByNormalizedDocument(
    tenantId: string,
    documentNumberNormalized: string,
    excludeSupplierId?: string
  ): Promise<ElectronicInvoicingSupplier | null> {
    const params: unknown[] = [tenantId, documentNumberNormalized];
    const clauses = [
      "tenant_id = $1",
      "COALESCE(identification_number, document_number_normalized) = $2",
    ];

    if (excludeSupplierId) {
      params.push(excludeSupplierId);
      clauses.push(`id <> $${params.length}`);
    }

    const result = await this.db.query<SupplierRow>(
      `
        SELECT ${supplierSelect}
        FROM suppliers
        WHERE ${clauses.join(" AND ")}
        LIMIT 1
      `,
      params
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async create(
    supplier: CreateElectronicInvoicingSupplierInput
  ): Promise<ElectronicInvoicingSupplier> {
    const result = await this.db.query<SupplierRow>(
      `
        INSERT INTO suppliers (
          id,
          tenant_id,
          name,
          document_number,
          document_type_code,
          document_number_normalized,
          dian_identification_type,
          identification_number,
          verification_digit,
          legal_name,
          trade_name,
          fiscal_email,
          invoice_email,
          phone,
          address,
          country_code,
          department_code,
          municipality_code,
          person_type,
          tax_regime,
          tax_responsibilities,
          fiscal_status,
          fiscal_provider,
          fiscal_data_source,
          is_dian_validated,
          fiscal_last_lookup_at,
          fiscal_last_lookup_status,
          dian_metadata,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29,
          NOW(), NOW()
        )
        RETURNING ${supplierSelect}
      `,
      [
        supplier.id,
        supplier.tenantId,
        supplier.name,
        supplier.documentNumber ?? null,
        supplier.documentTypeCode ?? null,
        supplier.documentNumberNormalized ?? null,
        supplier.dianIdentificationType ?? null,
        supplier.identificationNumber ?? null,
        supplier.verificationDigit ?? null,
        supplier.legalName ?? null,
        supplier.tradeName ?? null,
        supplier.fiscalEmail ?? null,
        supplier.invoiceEmail ?? null,
        supplier.phone ?? null,
        supplier.address ?? null,
        supplier.countryCode ?? null,
        supplier.departmentCode ?? null,
        supplier.municipalityCode ?? null,
        supplier.personType ?? null,
        supplier.taxRegime ?? null,
        supplier.taxResponsibilities ?? [],
        supplier.fiscalStatus ?? "PENDING",
        supplier.fiscalProvider ?? null,
        supplier.fiscalDataSource ?? "MANUAL",
        supplier.isDianValidated ?? false,
        supplier.fiscalLastLookupAt ?? null,
        supplier.fiscalLastLookupStatus ?? null,
        supplier.dianMetadata ?? {},
        supplier.isActive ?? true,
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateElectronicInvoicingSupplierInput
  ): Promise<ElectronicInvoicingSupplier | null> {
    const params: unknown[] = [id, tenantId];
    const sets: string[] = [];

    const addSet = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };

    if (hasOwn(data, "name")) {
      addSet("name", data.name ?? null);
    }
    if (hasOwn(data, "documentNumber")) {
      addSet("document_number", data.documentNumber ?? null);
    }
    if (hasOwn(data, "documentTypeCode")) {
      addSet("document_type_code", data.documentTypeCode ?? null);
    }
    if (hasOwn(data, "documentNumberNormalized")) {
      addSet("document_number_normalized", data.documentNumberNormalized ?? null);
    }
    if (hasOwn(data, "dianIdentificationType")) {
      addSet("dian_identification_type", data.dianIdentificationType ?? null);
    }
    if (hasOwn(data, "identificationNumber")) {
      addSet("identification_number", data.identificationNumber ?? null);
    }
    if (hasOwn(data, "verificationDigit")) {
      addSet("verification_digit", data.verificationDigit ?? null);
    }
    if (hasOwn(data, "legalName")) {
      addSet("legal_name", data.legalName ?? null);
    }
    if (hasOwn(data, "tradeName")) {
      addSet("trade_name", data.tradeName ?? null);
    }
    if (hasOwn(data, "fiscalEmail")) {
      addSet("fiscal_email", data.fiscalEmail ?? null);
    }
    if (hasOwn(data, "invoiceEmail")) {
      addSet("invoice_email", data.invoiceEmail ?? null);
    }
    if (hasOwn(data, "phone")) {
      addSet("phone", data.phone ?? null);
    }
    if (hasOwn(data, "address")) {
      addSet("address", data.address ?? null);
    }
    if (hasOwn(data, "countryCode")) {
      addSet("country_code", data.countryCode ?? null);
    }
    if (hasOwn(data, "departmentCode")) {
      addSet("department_code", data.departmentCode ?? null);
    }
    if (hasOwn(data, "municipalityCode")) {
      addSet("municipality_code", data.municipalityCode ?? null);
    }
    if (hasOwn(data, "personType")) {
      addSet("person_type", data.personType ?? null);
    }
    if (hasOwn(data, "taxRegime")) {
      addSet("tax_regime", data.taxRegime ?? null);
    }
    if (hasOwn(data, "taxResponsibilities")) {
      addSet("tax_responsibilities", data.taxResponsibilities ?? []);
    }
    if (hasOwn(data, "fiscalStatus")) {
      addSet("fiscal_status", data.fiscalStatus ?? "PENDING");
    }
    if (hasOwn(data, "fiscalProvider")) {
      addSet("fiscal_provider", data.fiscalProvider ?? null);
    }
    if (hasOwn(data, "fiscalDataSource")) {
      addSet("fiscal_data_source", data.fiscalDataSource ?? "MANUAL");
    }
    if (hasOwn(data, "isDianValidated")) {
      addSet("is_dian_validated", data.isDianValidated ?? false);
    }
    if (hasOwn(data, "fiscalLastLookupAt")) {
      addSet("fiscal_last_lookup_at", data.fiscalLastLookupAt ?? null);
    }
    if (hasOwn(data, "fiscalLastLookupStatus")) {
      addSet("fiscal_last_lookup_status", data.fiscalLastLookupStatus ?? null);
    }
    if (hasOwn(data, "dianMetadata")) {
      addSet("dian_metadata", data.dianMetadata ?? {});
    }
    if (hasOwn(data, "isActive")) {
      addSet("is_active", data.isActive ?? true);
    }

    if (sets.length === 0) {
      return this.findById(id, tenantId);
    }

    sets.push("updated_at = NOW()");

    const result = await this.db.query<SupplierRow>(
      `
        UPDATE suppliers
        SET ${sets.join(", ")}
        WHERE id = $1 AND tenant_id = $2
        RETURNING ${supplierSelect}
      `,
      params
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }
}
