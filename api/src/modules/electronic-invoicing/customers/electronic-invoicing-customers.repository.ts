import { Inject, Injectable } from "@nestjs/common";
import type { QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import type {
  CreateElectronicInvoicingCustomerInput,
  ElectronicInvoicingCustomer,
  ListElectronicInvoicingCustomersFilters,
  UpdateElectronicInvoicingCustomerInput,
} from "./electronic-invoicing-customer.types";

type CustomerRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  name: string;
  document_number: string | null;
  document_type_code: string | null;
  document_number_normalized: string | null;
  verification_digit: string | null;
  legal_name: string | null;
  fiscal_email: string | null;
  is_final_consumer: boolean;
  dian_last_lookup_at: string | Date | null;
  dian_last_lookup_status: ElectronicInvoicingCustomer["dianLastLookupStatus"];
  fiscal_status: ElectronicInvoicingCustomer["fiscalStatus"];
  is_active: boolean;
  created_at: string | Date;
  updated_at: string | Date;
};

const hasOwn = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

@Injectable()
export class ElectronicInvoicingCustomersRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService
  ) {}

  private mapRow(row: CustomerRow): ElectronicInvoicingCustomer {
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
      isFinalConsumer: row.is_final_consumer,
      dianLastLookupAt: row.dian_last_lookup_at
        ? new Date(row.dian_last_lookup_at)
        : null,
      dianLastLookupStatus: row.dian_last_lookup_status,
      fiscalStatus: row.fiscal_status,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async listByTenant(
    tenantId: string,
    filters: ListElectronicInvoicingCustomersFilters = {}
  ): Promise<ElectronicInvoicingCustomer[]> {
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

    if (filters.isFinalConsumer !== undefined) {
      params.push(filters.isFinalConsumer);
      clauses.push(`is_final_consumer = $${params.length}`);
    }

    if (filters.fiscalStatus) {
      params.push(filters.fiscalStatus);
      clauses.push(`fiscal_status = $${params.length}`);
    }

    if (filters.isActive !== undefined) {
      params.push(filters.isActive);
      clauses.push(`is_active = $${params.length}`);
    }

    const result = await this.db.query<CustomerRow>(
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
          is_final_consumer,
          dian_last_lookup_at,
          dian_last_lookup_status,
          fiscal_status,
          is_active,
          created_at,
          updated_at
        FROM customers
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
  ): Promise<ElectronicInvoicingCustomer | null> {
    const result = await this.db.query<CustomerRow>(
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
          is_final_consumer,
          dian_last_lookup_at,
          dian_last_lookup_status,
          fiscal_status,
          is_active,
          created_at,
          updated_at
        FROM customers
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
    excludeCustomerId?: string
  ): Promise<ElectronicInvoicingCustomer | null> {
    const params: unknown[] = [tenantId, documentNumberNormalized];
    const clauses = [
      "tenant_id = $1",
      "document_number_normalized = $2",
    ];

    if (excludeCustomerId) {
      params.push(excludeCustomerId);
      clauses.push(`id <> $${params.length}`);
    }

    const result = await this.db.query<CustomerRow>(
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
          is_final_consumer,
          dian_last_lookup_at,
          dian_last_lookup_status,
          fiscal_status,
          is_active,
          created_at,
          updated_at
        FROM customers
        WHERE ${clauses.join(" AND ")}
        LIMIT 1
      `,
      params
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findActiveFinalConsumer(
    tenantId: string,
    excludeCustomerId?: string
  ): Promise<ElectronicInvoicingCustomer | null> {
    const params: unknown[] = [tenantId];
    const clauses = [
      "tenant_id = $1",
      "is_final_consumer = true",
      "is_active = true",
    ];

    if (excludeCustomerId) {
      params.push(excludeCustomerId);
      clauses.push(`id <> $${params.length}`);
    }

    const result = await this.db.query<CustomerRow>(
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
          is_final_consumer,
          dian_last_lookup_at,
          dian_last_lookup_status,
          fiscal_status,
          is_active,
          created_at,
          updated_at
        FROM customers
        WHERE ${clauses.join(" AND ")}
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      params
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async create(
    customer: CreateElectronicInvoicingCustomerInput
  ): Promise<ElectronicInvoicingCustomer> {
    const result = await this.db.query<CustomerRow>(
      `
        INSERT INTO customers (
          id,
          tenant_id,
          name,
          document_number,
          document_type_code,
          document_number_normalized,
          verification_digit,
          legal_name,
          fiscal_email,
          is_final_consumer,
          is_default,
          fiscal_status,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, $12, NOW(), NOW()
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
          is_final_consumer,
          dian_last_lookup_at,
          dian_last_lookup_status,
          fiscal_status,
          is_active,
          created_at,
          updated_at
      `,
      [
        customer.id,
        customer.tenantId,
        customer.name,
        customer.documentNumber ?? null,
        customer.documentTypeCode ?? null,
        customer.documentNumberNormalized ?? null,
        customer.verificationDigit ?? null,
        customer.legalName ?? null,
        customer.fiscalEmail ?? null,
        customer.isFinalConsumer ?? false,
        customer.fiscalStatus ?? "PENDING",
        customer.isActive ?? true,
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateElectronicInvoicingCustomerInput
  ): Promise<ElectronicInvoicingCustomer | null> {
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
    if (hasOwn(data, "isFinalConsumer")) {
      addSet("is_final_consumer", data.isFinalConsumer ?? false);
      addSet("is_default", data.isFinalConsumer ?? false);
    }
    if (hasOwn(data, "fiscalStatus")) {
      addSet("fiscal_status", data.fiscalStatus ?? "PENDING");
    }
    if (hasOwn(data, "isActive")) {
      addSet("is_active", data.isActive ?? true);
    }

    if (sets.length === 0) {
      return this.findById(id, tenantId);
    }

    sets.push("updated_at = NOW()");

    const result = await this.db.query<CustomerRow>(
      `
        UPDATE customers
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
          is_final_consumer,
          dian_last_lookup_at,
          dian_last_lookup_status,
          fiscal_status,
          is_active,
          created_at,
          updated_at
      `,
      params
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }
}
