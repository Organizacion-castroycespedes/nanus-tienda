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
  verification_digit: string | null;
  legal_name: string | null;
  fiscal_email: string | null;
  fiscal_status: ElectronicInvoicingSupplier["fiscalStatus"];
  fiscal_provider: string | null;
  fiscal_last_lookup_at: string | Date | null;
  fiscal_last_lookup_status: ElectronicInvoicingSupplier["fiscalLastLookupStatus"];
  is_active: boolean;
  created_at: string | Date;
  updated_at: string | Date;
};

const hasOwn = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

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
      verificationDigit: row.verification_digit,
      legalName: row.legal_name,
      fiscalEmail: row.fiscal_email,
      fiscalStatus: row.fiscal_status,
      fiscalProvider: row.fiscal_provider,
      fiscalLastLookupAt: row.fiscal_last_lookup_at
        ? new Date(row.fiscal_last_lookup_at)
        : null,
      fiscalLastLookupStatus: row.fiscal_last_lookup_status,
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
        `(name ILIKE $${params.length} OR legal_name ILIKE $${params.length} OR document_number ILIKE $${params.length})`
      );
    }

    if (filters.documentTypeCode?.trim()) {
      params.push(filters.documentTypeCode.trim());
      clauses.push(`document_type_code = $${params.length}`);
    }

    if (filters.documentNumber?.trim()) {
      params.push(`%${filters.documentNumber.trim()}%`);
      clauses.push(
        `(document_number ILIKE $${params.length} OR document_number_normalized ILIKE $${params.length})`
      );
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
        SELECT
          id,
          tenant_id,
          name,
          document_number,
          document_type_code,
          document_number_normalized,
          verification_digit,
          legal_name,
          fiscal_email,
          fiscal_status,
          fiscal_provider,
          fiscal_last_lookup_at,
          fiscal_last_lookup_status,
          is_active,
          created_at,
          updated_at
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
        SELECT
          id,
          tenant_id,
          name,
          document_number,
          document_type_code,
          document_number_normalized,
          verification_digit,
          legal_name,
          fiscal_email,
          fiscal_status,
          fiscal_provider,
          fiscal_last_lookup_at,
          fiscal_last_lookup_status,
          is_active,
          created_at,
          updated_at
        FROM suppliers
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
      `,
      [id, tenantId]
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
      "document_number_normalized = $2",
    ];

    if (excludeSupplierId) {
      params.push(excludeSupplierId);
      clauses.push(`id <> $${params.length}`);
    }

    const result = await this.db.query<SupplierRow>(
      `
        SELECT
          id,
          tenant_id,
          name,
          document_number,
          document_type_code,
          document_number_normalized,
          verification_digit,
          legal_name,
          fiscal_email,
          fiscal_status,
          fiscal_provider,
          fiscal_last_lookup_at,
          fiscal_last_lookup_status,
          is_active,
          created_at,
          updated_at
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
          verification_digit,
          legal_name,
          fiscal_email,
          fiscal_status,
          fiscal_provider,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
        )
        RETURNING
          id,
          tenant_id,
          name,
          document_number,
          document_type_code,
          document_number_normalized,
          verification_digit,
          legal_name,
          fiscal_email,
          fiscal_status,
          fiscal_provider,
          fiscal_last_lookup_at,
          fiscal_last_lookup_status,
          is_active,
          created_at,
          updated_at
      `,
      [
        supplier.id,
        supplier.tenantId,
        supplier.name,
        supplier.documentNumber ?? null,
        supplier.documentTypeCode ?? null,
        supplier.documentNumberNormalized ?? null,
        supplier.verificationDigit ?? null,
        supplier.legalName ?? null,
        supplier.fiscalEmail ?? null,
        supplier.fiscalStatus ?? "PENDING",
        supplier.fiscalProvider ?? null,
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
    if (hasOwn(data, "verificationDigit")) {
      addSet("verification_digit", data.verificationDigit ?? null);
    }
    if (hasOwn(data, "legalName")) {
      addSet("legal_name", data.legalName ?? null);
    }
    if (hasOwn(data, "fiscalEmail")) {
      addSet("fiscal_email", data.fiscalEmail ?? null);
    }
    if (hasOwn(data, "fiscalStatus")) {
      addSet("fiscal_status", data.fiscalStatus ?? "PENDING");
    }
    if (hasOwn(data, "fiscalProvider")) {
      addSet("fiscal_provider", data.fiscalProvider ?? null);
    }
    if (hasOwn(data, "fiscalLastLookupStatus")) {
      addSet("fiscal_last_lookup_status", data.fiscalLastLookupStatus ?? null);
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
        RETURNING
          id,
          tenant_id,
          name,
          document_number,
          document_type_code,
          document_number_normalized,
          verification_digit,
          legal_name,
          fiscal_email,
          fiscal_status,
          fiscal_provider,
          fiscal_last_lookup_at,
          fiscal_last_lookup_status,
          is_active,
          created_at,
          updated_at
      `,
      params
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }
}
