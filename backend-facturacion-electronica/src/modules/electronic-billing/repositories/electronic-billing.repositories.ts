import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../database/database.service";
import {
  ElectronicDocumentConflictError,
  type ElectronicBillingEnvironment,
  type ElectronicBillingProviderRecord,
  type ElectronicDocumentAttachmentRecord,
  type ElectronicDocumentAttachmentType,
  type ElectronicDocumentBackgroundSyncRecord,
  type ElectronicDocumentDeliveryRecord,
  type ElectronicDocumentDeliveryType,
  type ElectronicDocumentEventRecord,
  type ElectronicDocumentEventType,
  type ElectronicDocumentLineRecord,
  type ElectronicDocumentReferenceRecord,
  type ElectronicDocumentReferenceType,
  type ElectronicDocumentRecord,
  type ElectronicDocumentSourceType,
  type ElectronicDocumentStatus,
  type ElectronicDocumentTaxRecord,
  type ElectronicDocumentType,
  type NewElectronicBillingProviderInput,
  type NewElectronicDocumentAttachmentInput,
  type NewElectronicDocumentDeliveryInput,
  type NewElectronicDocumentEventInput,
  type NewElectronicDocumentInput,
  type NewElectronicDocumentLineInput,
  type NewElectronicDocumentReferenceInput,
  type NewElectronicDocumentTaxInput,
  type NewTenantElectronicBillingConfigInput,
  type TenantElectronicBillingConfigRecord,
} from "./electronic-billing-records";

const toDateValue = (value: string | Date | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
};

const buildBulkValues = (rows: unknown[][]) => {
  const params: unknown[] = [];
  const values = rows
    .map((row) => {
      const placeholders = row.map((value) => {
        params.push(value);
        return `$${params.length}`;
      });
      return `(${placeholders.join(", ")})`;
    })
    .join(", ");

  return { params, values };
};

abstract class ElectronicBillingRepositoryBase {
  constructor(@Inject(DatabaseService) protected readonly db: DatabaseService) {}

  protected async query<T extends QueryResultRow>(
    text: string,
    params: unknown[] = [],
    client?: PoolClient
  ) {
    if (client) {
      return client.query<T>(text, params);
    }
    return this.db.query<T>(text, params);
  }

  protected async queryOne<T extends QueryResultRow>(
    text: string,
    params: unknown[] = [],
    client?: PoolClient
  ): Promise<T | null> {
    const result = await this.query<T>(text, params, client);
    return result.rows[0] ?? null;
  }
}

@Injectable()
export class ElectronicBillingProviderRepository extends ElectronicBillingRepositoryBase {
  constructor(@Inject(DatabaseService) db: DatabaseService) {
    super(db);
  }

  async findById(id: string, client?: PoolClient) {
    return this.queryOne<ElectronicBillingProviderRecord>(
      `SELECT
        id,
        code,
        name,
        provider_type,
        active,
        capabilities,
        created_at,
        updated_at
      FROM electronic_billing_providers
      WHERE id = $1
      LIMIT 1`,
      [id],
      client
    );
  }

  async findByCode(code: string, client?: PoolClient) {
    return this.queryOne<ElectronicBillingProviderRecord>(
      `SELECT
        id,
        code,
        name,
        provider_type,
        active,
        capabilities,
        created_at,
        updated_at
      FROM electronic_billing_providers
      WHERE code = $1
      LIMIT 1`,
      [code],
      client
    );
  }

  async listActive(client?: PoolClient) {
    const result = await this.query<ElectronicBillingProviderRecord>(
      `SELECT
        id,
        code,
        name,
        provider_type,
        active,
        capabilities,
        created_at,
        updated_at
      FROM electronic_billing_providers
      WHERE active = TRUE
      ORDER BY code ASC`,
      [],
      client
    );

    return result.rows;
  }

  async create(input: NewElectronicBillingProviderInput, client?: PoolClient) {
    return this.queryOne<ElectronicBillingProviderRecord>(
      `INSERT INTO electronic_billing_providers (
        id,
        code,
        name,
        provider_type,
        active,
        capabilities,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        code,
        name,
        provider_type,
        active,
        capabilities,
        created_at,
        updated_at`,
      [
        input.id,
        input.code,
        input.name,
        input.providerType ?? "ELECTRONIC_BILLING",
        input.active ?? true,
        input.capabilities ?? [],
        input.createdAt,
        input.updatedAt,
      ],
      client
    );
  }
}

@Injectable()
export class TenantElectronicBillingConfigRepository extends ElectronicBillingRepositoryBase {
  constructor(@Inject(DatabaseService) db: DatabaseService) {
    super(db);
  }

  async findById(id: string, tenantId?: string, client?: PoolClient) {
    const params: unknown[] = [id];
    let where = "id = $1";

    if (tenantId) {
      params.push(tenantId);
      where += ` AND tenant_id = $${params.length}`;
    }

    return this.queryOne<TenantElectronicBillingConfigRecord>(
      `SELECT
        id,
        tenant_id,
        provider_id,
        environment,
        enabled,
        base_url,
        credential_reference,
        settings,
        is_default,
        created_at,
        updated_at
      FROM tenant_electronic_billing_configs
      WHERE ${where}
      LIMIT 1`,
      params,
      client
    );
  }

  async findEnabledForTenant(tenantId: string, client?: PoolClient) {
    const result = await this.query<TenantElectronicBillingConfigRecord>(
      `SELECT
        id,
        tenant_id,
        provider_id,
        environment,
        enabled,
        base_url,
        credential_reference,
        settings,
        is_default,
        created_at,
        updated_at
      FROM tenant_electronic_billing_configs
      WHERE tenant_id = $1
        AND enabled = TRUE
      ORDER BY is_default DESC, created_at DESC`,
      [tenantId],
      client
    );

    return result.rows;
  }

  async findByTenantAndProvider(
    tenantId: string,
    providerId: string,
    environment?: ElectronicBillingEnvironment,
    client?: PoolClient
  ) {
    const params: unknown[] = [tenantId, providerId];
    let where = "tenant_id = $1 AND provider_id = $2";

    if (environment) {
      params.push(environment);
      where += ` AND environment = $${params.length}`;
    }

    return this.queryOne<TenantElectronicBillingConfigRecord>(
      `SELECT
        id,
        tenant_id,
        provider_id,
        environment,
        enabled,
        base_url,
        credential_reference,
        settings,
        is_default,
        created_at,
        updated_at
      FROM tenant_electronic_billing_configs
      WHERE ${where}
      ORDER BY is_default DESC, created_at DESC
      LIMIT 1`,
      params,
      client
    );
  }

  async findDefaultForTenant(tenantId: string, client?: PoolClient) {
    return this.queryOne<TenantElectronicBillingConfigRecord>(
      `SELECT
        id,
        tenant_id,
        provider_id,
        environment,
        enabled,
        base_url,
        credential_reference,
        settings,
        is_default,
        created_at,
        updated_at
      FROM tenant_electronic_billing_configs
      WHERE tenant_id = $1
        AND is_default = TRUE
        AND enabled = TRUE
      ORDER BY updated_at DESC
      LIMIT 1`,
      [tenantId],
      client
    );
  }

  async create(
    input: NewTenantElectronicBillingConfigInput,
    client?: PoolClient
  ) {
    return this.queryOne<TenantElectronicBillingConfigRecord>(
      `INSERT INTO tenant_electronic_billing_configs (
        id,
        tenant_id,
        provider_id,
        environment,
        enabled,
        base_url,
        credential_reference,
        settings,
        is_default,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING
        id,
        tenant_id,
        provider_id,
        environment,
        enabled,
        base_url,
        credential_reference,
        settings,
        is_default,
        created_at,
        updated_at`,
      [
        input.id,
        input.tenantId,
        input.providerId,
        input.environment,
        input.enabled ?? false,
        input.baseUrl ?? null,
        input.credentialReference ?? null,
        input.settings ?? {},
        input.isDefault ?? false,
        input.createdAt,
        input.updatedAt,
      ],
      client
    );
  }
}

export type ElectronicDocumentIdentityUpdate = {
  providerDocumentId?: string | null;
  prefix?: string | null;
  number?: number | string | null;
  fullNumber?: string | null;
  cufe?: string | null;
  cude?: string | null;
  providerStatus?: string | null;
  providerStatusDetail?: string | null;
  lastStatusCheckAt?: Date | string | null;
};

export type ElectronicDocumentStatusUpdate = {
  status?: ElectronicDocumentStatus;
  providerStatus?: string | null;
  providerStatusDetail?: string | null;
  sentAt?: Date | string | null;
  acceptedAt?: Date | string | null;
  rejectedAt?: Date | string | null;
  lastStatusCheckAt?: Date | string | null;
};

export type ElectronicDocumentErrorUpdate = {
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
};

export type ElectronicDocumentClaimOptions = {
  allowedStatuses: ElectronicDocumentStatus[];
};

type BackgroundSyncClaimOptions = {
  statuses: ElectronicDocumentStatus[];
  dueBefore: Date | string;
  limit: number;
  leaseMs?: number;
};

@Injectable()
export class ElectronicDocumentRepository extends ElectronicBillingRepositoryBase {
  constructor(@Inject(DatabaseService) db: DatabaseService) {
    super(db);
  }

  async create(input: NewElectronicDocumentInput, client?: PoolClient) {
    try {
      return await this.queryOne<ElectronicDocumentRecord>(
        `INSERT INTO electronic_documents (
          id,
          tenant_id,
          provider_id,
          provider_config_id,
          document_type,
          source_type,
          source_id,
          external_reference,
          provider_document_id,
          prefix,
          number,
          full_number,
          status,
          provider_status,
          provider_status_detail,
          cufe,
          cude,
          currency_code,
          subtotal_amount,
          discount_amount,
          tax_amount,
          total_amount,
          issue_date,
          issue_time,
          sent_at,
          accepted_at,
          rejected_at,
          last_status_check_at,
          last_error_code,
          last_error_message,
          metadata,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33
        )
        RETURNING
          id,
          tenant_id,
          provider_id,
          provider_config_id,
          document_type,
          source_type,
          source_id,
          external_reference,
          provider_document_id,
          prefix,
          number,
          full_number,
          status,
          provider_status,
          provider_status_detail,
          cufe,
          cude,
          currency_code,
          subtotal_amount,
          discount_amount,
          tax_amount,
          total_amount,
          issue_date,
          issue_time,
          sent_at,
          accepted_at,
          rejected_at,
          last_status_check_at,
          last_error_code,
          last_error_message,
          metadata,
          created_at,
          updated_at`,
        [
          input.id,
          input.tenantId,
          input.providerId,
          input.providerConfigId,
          input.documentType,
          input.sourceType,
          input.sourceId ?? null,
          input.externalReference,
          input.providerDocumentId ?? null,
          input.prefix ?? null,
          input.number ?? null,
          input.fullNumber ?? null,
          input.status ?? "PENDING",
          input.providerStatus ?? null,
          input.providerStatusDetail ?? null,
          input.cufe ?? null,
          input.cude ?? null,
          input.currencyCode ?? "COP",
          input.subtotalAmount,
          input.discountAmount,
          input.taxAmount,
          input.totalAmount,
          toDateValue(input.issueDate),
          input.issueTime ?? null,
          toDateValue(input.sentAt),
          toDateValue(input.acceptedAt),
          toDateValue(input.rejectedAt),
          toDateValue(input.lastStatusCheckAt),
          input.lastErrorCode ?? null,
          input.lastErrorMessage ?? null,
          input.metadata ?? {},
          input.createdAt,
          input.updatedAt,
        ],
        client
      );
    } catch (error) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        (error as { code?: string }).code === "23505"
      ) {
        throw new ElectronicDocumentConflictError("Electronic document idempotency conflict");
      }
      throw error;
    }
  }

  async findById(tenantId: string, id: string, client?: PoolClient) {
    return this.queryOne<ElectronicDocumentRecord>(
      `SELECT
        id,
        tenant_id,
        provider_id,
        provider_config_id,
        document_type,
        source_type,
        source_id,
        external_reference,
        provider_document_id,
        prefix,
        number,
        full_number,
        status,
        provider_status,
        provider_status_detail,
        cufe,
        cude,
        currency_code,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount,
        issue_date,
        issue_time,
        sent_at,
        accepted_at,
        rejected_at,
        last_status_check_at,
        last_error_code,
        last_error_message,
        metadata,
        created_at,
        updated_at
      FROM electronic_documents
      WHERE tenant_id = $1
        AND id = $2
      LIMIT 1`,
      [tenantId, id],
      client
    );
  }

  async findByExternalReference(
    tenantId: string,
    documentType: ElectronicDocumentType,
    externalReference: string,
    providerId?: string,
    client?: PoolClient
  ) {
    const params: unknown[] = [tenantId, documentType, externalReference];
    let where = "tenant_id = $1 AND document_type = $2 AND external_reference = $3";

    if (providerId) {
      params.push(providerId);
      where += ` AND provider_id = $${params.length}`;
    }

    return this.queryOne<ElectronicDocumentRecord>(
      `SELECT
        id,
        tenant_id,
        provider_id,
        provider_config_id,
        document_type,
        source_type,
        source_id,
        external_reference,
        provider_document_id,
        prefix,
        number,
        full_number,
        status,
        provider_status,
        provider_status_detail,
        cufe,
        cude,
        currency_code,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount,
        issue_date,
        issue_time,
        sent_at,
        accepted_at,
        rejected_at,
        last_status_check_at,
        last_error_code,
        last_error_message,
        metadata,
        created_at,
        updated_at
      FROM electronic_documents
      WHERE ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
      params,
      client
    );
  }

  async findBySource(
    tenantId: string,
    sourceType: ElectronicDocumentSourceType,
    sourceId: string,
    documentType?: ElectronicDocumentType,
    providerId?: string,
    client?: PoolClient
  ) {
    const params: unknown[] = [tenantId, sourceType, sourceId];
    let where = "tenant_id = $1 AND source_type = $2 AND source_id = $3";

    if (documentType) {
      params.push(documentType);
      where += ` AND document_type = $${params.length}`;
    }

    if (providerId) {
      params.push(providerId);
      where += ` AND provider_id = $${params.length}`;
    }

    return this.queryOne<ElectronicDocumentRecord>(
      `SELECT
        id,
        tenant_id,
        provider_id,
        provider_config_id,
        document_type,
        source_type,
        source_id,
        external_reference,
        provider_document_id,
        prefix,
        number,
        full_number,
        status,
        provider_status,
        provider_status_detail,
        cufe,
        cude,
        currency_code,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount,
        issue_date,
        issue_time,
        sent_at,
        accepted_at,
        rejected_at,
        last_status_check_at,
        last_error_code,
        last_error_message,
        metadata,
        created_at,
        updated_at
      FROM electronic_documents
      WHERE ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
      params,
      client
    );
  }

  async findByProviderDocumentId(
    tenantId: string,
    providerId: string,
    providerDocumentId: string,
    client?: PoolClient
  ) {
    return this.queryOne<ElectronicDocumentRecord>(
      `SELECT
        id,
        tenant_id,
        provider_id,
        provider_config_id,
        document_type,
        source_type,
        source_id,
        external_reference,
        provider_document_id,
        prefix,
        number,
        full_number,
        status,
        provider_status,
        provider_status_detail,
        cufe,
        cude,
        currency_code,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount,
        issue_date,
        issue_time,
        sent_at,
        accepted_at,
        rejected_at,
        last_status_check_at,
        last_error_code,
        last_error_message,
        metadata,
        created_at,
        updated_at
      FROM electronic_documents
      WHERE tenant_id = $1
        AND provider_id = $2
        AND provider_document_id = $3
      LIMIT 1`,
      [tenantId, providerId, providerDocumentId],
      client
    );
  }

  async updateProviderIdentity(
    tenantId: string,
    id: string,
    updates: ElectronicDocumentIdentityUpdate,
    client?: PoolClient
  ) {
    const sets: string[] = [];
    const params: unknown[] = [tenantId, id];

    const add = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };

    if (updates.providerDocumentId !== undefined) add("provider_document_id", updates.providerDocumentId);
    if (updates.prefix !== undefined) add("prefix", updates.prefix);
    if (updates.number !== undefined) add("number", updates.number);
    if (updates.fullNumber !== undefined) add("full_number", updates.fullNumber);
    if (updates.cufe !== undefined) add("cufe", updates.cufe);
    if (updates.cude !== undefined) add("cude", updates.cude);
    if (updates.providerStatus !== undefined) add("provider_status", updates.providerStatus);
    if (updates.providerStatusDetail !== undefined) add("provider_status_detail", updates.providerStatusDetail);
    if (updates.lastStatusCheckAt !== undefined) add("last_status_check_at", toDateValue(updates.lastStatusCheckAt));

    if (sets.length === 0) {
      return this.findById(tenantId, id, client);
    }

    return this.queryOne<ElectronicDocumentRecord>(
      `UPDATE electronic_documents
      SET ${sets.join(", ")}
      WHERE tenant_id = $1
        AND id = $2
      RETURNING
        id,
        tenant_id,
        provider_id,
        provider_config_id,
        document_type,
        source_type,
        source_id,
        external_reference,
        provider_document_id,
        prefix,
        number,
        full_number,
        status,
        provider_status,
        provider_status_detail,
        cufe,
        cude,
        currency_code,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount,
        issue_date,
        issue_time,
        sent_at,
        accepted_at,
        rejected_at,
        last_status_check_at,
        last_error_code,
        last_error_message,
        metadata,
        created_at,
        updated_at`,
      params,
      client
    );
  }

  async updateStatus(
    tenantId: string,
    id: string,
    updates: ElectronicDocumentStatusUpdate,
    client?: PoolClient
  ) {
    const sets: string[] = [];
    const params: unknown[] = [tenantId, id];
    const add = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };

    if (updates.status !== undefined) add("status", updates.status);
    if (updates.providerStatus !== undefined) add("provider_status", updates.providerStatus);
    if (updates.providerStatusDetail !== undefined) add("provider_status_detail", updates.providerStatusDetail);
    if (updates.sentAt !== undefined) add("sent_at", toDateValue(updates.sentAt));
    if (updates.acceptedAt !== undefined) add("accepted_at", toDateValue(updates.acceptedAt));
    if (updates.rejectedAt !== undefined) add("rejected_at", toDateValue(updates.rejectedAt));
    if (updates.lastStatusCheckAt !== undefined) add("last_status_check_at", toDateValue(updates.lastStatusCheckAt));

    if (sets.length === 0) {
      return this.findById(tenantId, id, client);
    }

    return this.queryOne<ElectronicDocumentRecord>(
      `UPDATE electronic_documents
      SET ${sets.join(", ")}
      WHERE tenant_id = $1
        AND id = $2
      RETURNING
        id,
        tenant_id,
        provider_id,
        provider_config_id,
        document_type,
        source_type,
        source_id,
        external_reference,
        provider_document_id,
        prefix,
        number,
        full_number,
        status,
        provider_status,
        provider_status_detail,
        cufe,
        cude,
        currency_code,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount,
        issue_date,
        issue_time,
        sent_at,
        accepted_at,
        rejected_at,
        last_status_check_at,
        last_error_code,
        last_error_message,
        metadata,
        created_at,
        updated_at`,
      params,
      client
    );
  }

  async updateError(
    tenantId: string,
    id: string,
    updates: ElectronicDocumentErrorUpdate,
    client?: PoolClient
  ) {
    const sets: string[] = [];
    const params: unknown[] = [tenantId, id];
    const add = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };

    if (updates.lastErrorCode !== undefined) add("last_error_code", updates.lastErrorCode);
    if (updates.lastErrorMessage !== undefined) add("last_error_message", updates.lastErrorMessage);

    if (sets.length === 0) {
      return this.findById(tenantId, id, client);
    }

    return this.queryOne<ElectronicDocumentRecord>(
      `UPDATE electronic_documents
      SET ${sets.join(", ")}
      WHERE tenant_id = $1
        AND id = $2
      RETURNING
        id,
        tenant_id,
        provider_id,
        provider_config_id,
        document_type,
        source_type,
        source_id,
        external_reference,
        provider_document_id,
        prefix,
        number,
        full_number,
        status,
        provider_status,
        provider_status_detail,
        cufe,
        cude,
        currency_code,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount,
        issue_date,
        issue_time,
        sent_at,
        accepted_at,
        rejected_at,
        last_status_check_at,
        last_error_code,
        last_error_message,
        metadata,
        created_at,
        updated_at`,
      params,
      client
    );
  }

  async claimForProcessing(
    tenantId: string,
    id: string,
    options: ElectronicDocumentClaimOptions,
    client?: PoolClient
  ) {
    if (options.allowedStatuses.length === 0) {
      return null;
    }

    return this.queryOne<ElectronicDocumentRecord>(
      `UPDATE electronic_documents
      SET status = 'PROCESSING',
          last_status_check_at = NOW(),
          updated_at = NOW()
      WHERE tenant_id = $1
        AND id = $2
        AND status = ANY($3::text[])
      RETURNING
        id,
        tenant_id,
        provider_id,
        provider_config_id,
        document_type,
        source_type,
        source_id,
        external_reference,
        provider_document_id,
        prefix,
        number,
        full_number,
        status,
        provider_status,
        provider_status_detail,
        cufe,
        cude,
        currency_code,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount,
        issue_date,
        issue_time,
        sent_at,
        accepted_at,
        rejected_at,
        last_status_check_at,
        last_error_code,
        last_error_message,
        metadata,
        created_at,
        updated_at`,
      [tenantId, id, options.allowedStatuses],
      client
    );
  }

  async claimDueForBackgroundSync(
    options: BackgroundSyncClaimOptions,
    client?: PoolClient
  ) {
    if (options.statuses.length === 0 || options.limit <= 0) {
      return [];
    }

    const result = await this.query<ElectronicDocumentBackgroundSyncRecord>(
      `WITH claimed AS (
        SELECT d.id
        FROM electronic_documents d
        WHERE d.status = ANY($1::text[])
          AND (d.last_status_check_at IS NULL OR d.last_status_check_at <= $2)
        ORDER BY COALESCE(d.last_status_check_at, d.created_at) ASC, d.created_at ASC, d.id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $3
      )
      UPDATE electronic_documents d
      SET last_status_check_at = NOW() + ($4::bigint * INTERVAL '1 millisecond'),
          updated_at = NOW()
      FROM claimed c
      WHERE d.id = c.id
      RETURNING
        d.id,
        d.tenant_id,
        d.provider_id,
        d.provider_config_id,
        d.document_type,
        d.source_type,
        d.source_id,
        d.external_reference,
        d.provider_document_id,
        d.prefix,
        d.number,
        d.full_number,
        d.status,
        d.provider_status,
        d.provider_status_detail,
        d.cufe,
        d.cude,
        d.currency_code,
        d.subtotal_amount,
        d.discount_amount,
        d.tax_amount,
        d.total_amount,
        d.issue_date,
        d.issue_time,
        d.sent_at,
        d.accepted_at,
        d.rejected_at,
        d.last_status_check_at,
        d.last_error_code,
        d.last_error_message,
        d.metadata,
        d.created_at,
        d.updated_at,
        COALESCE((
          SELECT MAX(e.attempt)
          FROM electronic_document_events e
          WHERE e.electronic_document_id = d.id
        ), 0)::int AS latest_attempt`,
      [options.statuses, options.dueBefore, options.limit, options.leaseMs ?? 0],
      client
    );

    return result.rows;
  }
}

@Injectable()
export class ElectronicDocumentLineRepository extends ElectronicBillingRepositoryBase {
  constructor(@Inject(DatabaseService) db: DatabaseService) {
    super(db);
  }

  async insertMany(
    items: NewElectronicDocumentLineInput[],
    client?: PoolClient
  ) {
    if (items.length === 0) {
      return [];
    }

    const { params, values } = buildBulkValues(
      items.map((item) => [
        item.id,
        item.electronicDocumentId,
        item.sourceLineType,
        item.sourceLineId ?? null,
        item.providerLineId ?? null,
        item.sku ?? null,
        item.description,
        item.quantity,
        item.unitCode ?? null,
        item.unitPrice,
        item.discountAmount,
        item.subtotalAmount,
        item.taxAmount,
        item.totalAmount,
        item.taxTreatment ?? null,
        item.metadata ?? {},
        item.createdAt,
        item.updatedAt,
      ])
    );

    const result = await this.query<ElectronicDocumentLineRecord>(
      `INSERT INTO electronic_document_lines (
        id,
        electronic_document_id,
        source_line_type,
        source_line_id,
        provider_line_id,
        sku,
        description,
        quantity,
        unit_code,
        unit_price,
        discount_amount,
        subtotal_amount,
        tax_amount,
        total_amount,
        tax_treatment,
        metadata,
        created_at,
        updated_at
      ) VALUES ${values}
      RETURNING
        id,
        electronic_document_id,
        source_line_type,
        source_line_id,
        provider_line_id,
        sku,
        description,
        quantity,
        unit_code,
        unit_price,
        discount_amount,
        subtotal_amount,
        tax_amount,
        total_amount,
        tax_treatment,
        metadata,
        created_at,
        updated_at`,
      params,
      client
    );

    return result.rows;
  }

  async findByDocumentId(
    tenantId: string,
    electronicDocumentId: string,
    client?: PoolClient
  ) {
    const result = await this.query<ElectronicDocumentLineRecord>(
      `SELECT
        l.id,
        l.electronic_document_id,
        l.source_line_type,
        l.source_line_id,
        l.provider_line_id,
        l.sku,
        l.description,
        l.quantity,
        l.unit_code,
        l.unit_price,
        l.discount_amount,
        l.subtotal_amount,
        l.tax_amount,
        l.total_amount,
        l.tax_treatment,
        l.metadata,
        l.created_at,
        l.updated_at
      FROM electronic_document_lines l
      INNER JOIN electronic_documents d ON d.id = l.electronic_document_id
      WHERE d.tenant_id = $1
        AND l.electronic_document_id = $2
      ORDER BY l.created_at ASC, l.id ASC`,
      [tenantId, electronicDocumentId],
      client
    );

    return result.rows;
  }

  async findBySourceLine(
    tenantId: string,
    sourceLineType: ElectronicDocumentSourceType,
    sourceLineId: string,
    client?: PoolClient
  ) {
    const result = await this.query<ElectronicDocumentLineRecord>(
      `SELECT
        l.id,
        l.electronic_document_id,
        l.source_line_type,
        l.source_line_id,
        l.provider_line_id,
        l.sku,
        l.description,
        l.quantity,
        l.unit_code,
        l.unit_price,
        l.discount_amount,
        l.subtotal_amount,
        l.tax_amount,
        l.total_amount,
        l.tax_treatment,
        l.metadata,
        l.created_at,
        l.updated_at
      FROM electronic_document_lines l
      INNER JOIN electronic_documents d ON d.id = l.electronic_document_id
      WHERE d.tenant_id = $1
        AND l.source_line_type = $2
        AND l.source_line_id = $3
      ORDER BY l.created_at ASC, l.id ASC`,
      [tenantId, sourceLineType, sourceLineId],
      client
    );

    return result.rows;
  }

  async updateProviderLineId(
    tenantId: string,
    lineId: string,
    providerLineId: string | null,
    client?: PoolClient
  ) {
    return this.queryOne<ElectronicDocumentLineRecord>(
      `UPDATE electronic_document_lines l
      SET provider_line_id = $3,
          updated_at = NOW()
      FROM electronic_documents d
      WHERE l.electronic_document_id = d.id
        AND d.tenant_id = $1
        AND l.id = $2
      RETURNING
        l.id,
        l.electronic_document_id,
        l.source_line_type,
        l.source_line_id,
        l.provider_line_id,
        l.sku,
        l.description,
        l.quantity,
        l.unit_code,
        l.unit_price,
        l.discount_amount,
        l.subtotal_amount,
        l.tax_amount,
        l.total_amount,
        l.tax_treatment,
        l.metadata,
        l.created_at,
        l.updated_at`,
      [tenantId, lineId, providerLineId],
      client
    );
  }
}

@Injectable()
export class ElectronicDocumentTaxRepository extends ElectronicBillingRepositoryBase {
  constructor(@Inject(DatabaseService) db: DatabaseService) {
    super(db);
  }

  async insertMany(items: NewElectronicDocumentTaxInput[], client?: PoolClient) {
    if (items.length === 0) {
      return [];
    }

    const { params, values } = buildBulkValues(
      items.map((item) => [
        item.id,
        item.electronicDocumentId,
        item.electronicDocumentLineId ?? null,
        item.taxType,
        item.taxCode ?? null,
        item.taxSchemeId ?? null,
        item.taxSchemeName ?? null,
        item.rate,
        item.taxableBase,
        item.taxAmount,
        item.metadata ?? {},
        item.createdAt,
      ])
    );

    const result = await this.query<ElectronicDocumentTaxRecord>(
      `INSERT INTO electronic_document_taxes (
        id,
        electronic_document_id,
        electronic_document_line_id,
        tax_type,
        tax_code,
        tax_scheme_id,
        tax_scheme_name,
        rate,
        taxable_base,
        tax_amount,
        metadata,
        created_at
      ) VALUES ${values}
      RETURNING
        id,
        electronic_document_id,
        electronic_document_line_id,
        tax_type,
        tax_code,
        tax_scheme_id,
        tax_scheme_name,
        rate,
        taxable_base,
        tax_amount,
        metadata,
        created_at`,
      params,
      client
    );

    return result.rows;
  }

  async findByDocumentId(
    tenantId: string,
    electronicDocumentId: string,
    client?: PoolClient
  ) {
    const result = await this.query<ElectronicDocumentTaxRecord>(
      `SELECT
        t.id,
        t.electronic_document_id,
        t.electronic_document_line_id,
        t.tax_type,
        t.tax_code,
        t.tax_scheme_id,
        t.tax_scheme_name,
        t.rate,
        t.taxable_base,
        t.tax_amount,
        t.metadata,
        t.created_at
      FROM electronic_document_taxes t
      INNER JOIN electronic_documents d ON d.id = t.electronic_document_id
      WHERE d.tenant_id = $1
        AND t.electronic_document_id = $2
      ORDER BY t.created_at ASC, t.id ASC`,
      [tenantId, electronicDocumentId],
      client
    );

    return result.rows;
  }

  async findByLineId(
    tenantId: string,
    electronicDocumentLineId: string,
    client?: PoolClient
  ) {
    const result = await this.query<ElectronicDocumentTaxRecord>(
      `SELECT
        t.id,
        t.electronic_document_id,
        t.electronic_document_line_id,
        t.tax_type,
        t.tax_code,
        t.tax_scheme_id,
        t.tax_scheme_name,
        t.rate,
        t.taxable_base,
        t.tax_amount,
        t.metadata,
        t.created_at
      FROM electronic_document_taxes t
      INNER JOIN electronic_documents d ON d.id = t.electronic_document_id
      WHERE d.tenant_id = $1
        AND t.electronic_document_line_id = $2
      ORDER BY t.created_at ASC, t.id ASC`,
      [tenantId, electronicDocumentLineId],
      client
    );

    return result.rows;
  }
}

@Injectable()
export class ElectronicDocumentReferenceRepository extends ElectronicBillingRepositoryBase {
  constructor(@Inject(DatabaseService) db: DatabaseService) {
    super(db);
  }

  async create(input: NewElectronicDocumentReferenceInput, client?: PoolClient) {
    return this.queryOne<ElectronicDocumentReferenceRecord>(
      `INSERT INTO electronic_document_references (
        id,
        electronic_document_id,
        referenced_electronic_document_id,
        reference_type,
        provider_referenced_document_id,
        reference_number,
        external_reference,
        reason_code,
        reason_description,
        metadata,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING
        id,
        electronic_document_id,
        referenced_electronic_document_id,
        reference_type,
        provider_referenced_document_id,
        reference_number,
        external_reference,
        reason_code,
        reason_description,
        metadata,
        created_at`,
      [
        input.id,
        input.electronicDocumentId,
        input.referencedElectronicDocumentId ?? null,
        input.referenceType,
        input.providerReferencedDocumentId ?? null,
        input.referenceNumber ?? null,
        input.externalReference ?? null,
        input.reasonCode ?? null,
        input.reasonDescription ?? null,
        input.metadata ?? {},
        input.createdAt,
      ],
      client
    );
  }

  async findByDocumentId(
    tenantId: string,
    electronicDocumentId: string,
    client?: PoolClient
  ) {
    const result = await this.query<ElectronicDocumentReferenceRecord>(
      `SELECT
        r.id,
        r.electronic_document_id,
        r.referenced_electronic_document_id,
        r.reference_type,
        r.provider_referenced_document_id,
        r.reference_number,
        r.external_reference,
        r.reason_code,
        r.reason_description,
        r.metadata,
        r.created_at
      FROM electronic_document_references r
      INNER JOIN electronic_documents d ON d.id = r.electronic_document_id
      WHERE d.tenant_id = $1
        AND r.electronic_document_id = $2
      ORDER BY r.created_at ASC, r.id ASC`,
      [tenantId, electronicDocumentId],
      client
    );

    return result.rows;
  }

  async findReferencingDocument(
    tenantId: string,
    referencedElectronicDocumentId: string,
    client?: PoolClient
  ) {
    const result = await this.query<ElectronicDocumentReferenceRecord>(
      `SELECT
        r.id,
        r.electronic_document_id,
        r.referenced_electronic_document_id,
        r.reference_type,
        r.provider_referenced_document_id,
        r.reference_number,
        r.external_reference,
        r.reason_code,
        r.reason_description,
        r.metadata,
        r.created_at
      FROM electronic_document_references r
      INNER JOIN electronic_documents d ON d.id = r.electronic_document_id
      WHERE d.tenant_id = $1
        AND r.referenced_electronic_document_id = $2
      ORDER BY r.created_at ASC, r.id ASC`,
      [tenantId, referencedElectronicDocumentId],
      client
    );

    return result.rows;
  }
}

@Injectable()
export class ElectronicDocumentEventRepository extends ElectronicBillingRepositoryBase {
  constructor(@Inject(DatabaseService) db: DatabaseService) {
    super(db);
  }

  async append(input: NewElectronicDocumentEventInput, client?: PoolClient) {
    return this.queryOne<ElectronicDocumentEventRecord>(
      `INSERT INTO electronic_document_events (
        id,
        electronic_document_id,
        event_type,
        status,
        provider_status,
        operation,
        attempt,
        http_status,
        error_code,
        error_message,
        metadata,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING
        id,
        electronic_document_id,
        event_type,
        status,
        provider_status,
        operation,
        attempt,
        http_status,
        error_code,
        error_message,
        metadata,
        created_at`,
      [
        input.id,
        input.electronicDocumentId,
        input.eventType,
        input.status ?? null,
        input.providerStatus ?? null,
        input.operation,
        input.attempt ?? 1,
        input.httpStatus ?? null,
        input.errorCode ?? null,
        input.errorMessage ?? null,
        input.metadata ?? {},
        input.createdAt,
      ],
      client
    );
  }

  async listByDocumentId(
    tenantId: string,
    electronicDocumentId: string,
    client?: PoolClient
  ) {
    const result = await this.query<ElectronicDocumentEventRecord>(
      `SELECT
        e.id,
        e.electronic_document_id,
        e.event_type,
        e.status,
        e.provider_status,
        e.operation,
        e.attempt,
        e.http_status,
        e.error_code,
        e.error_message,
        e.metadata,
        e.created_at
      FROM electronic_document_events e
      INNER JOIN electronic_documents d ON d.id = e.electronic_document_id
      WHERE d.tenant_id = $1
        AND e.electronic_document_id = $2
      ORDER BY e.created_at ASC, e.id ASC`,
      [tenantId, electronicDocumentId],
      client
    );

    return result.rows;
  }
}

@Injectable()
export class ElectronicDocumentAttachmentRepository extends ElectronicBillingRepositoryBase {
  constructor(@Inject(DatabaseService) db: DatabaseService) {
    super(db);
  }

  async create(
    input: NewElectronicDocumentAttachmentInput,
    client?: PoolClient
  ) {
    return this.queryOne<ElectronicDocumentAttachmentRecord>(
      `INSERT INTO electronic_document_attachments (
        id,
        electronic_document_id,
        attachment_type,
        provider_attachment_id,
        storage_provider,
        storage_key,
        file_name,
        mime_type,
        checksum,
        size_bytes,
        status,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING
        id,
        electronic_document_id,
        attachment_type,
        provider_attachment_id,
        storage_provider,
        storage_key,
        file_name,
        mime_type,
        checksum,
        size_bytes,
        status,
        created_at,
        updated_at`,
      [
        input.id,
        input.electronicDocumentId,
        input.attachmentType,
        input.providerAttachmentId ?? null,
        input.storageProvider ?? null,
        input.storageKey ?? null,
        input.fileName ?? null,
        input.mimeType ?? null,
        input.checksum ?? null,
        input.sizeBytes ?? null,
        input.status ?? "PENDING",
        input.createdAt,
        input.updatedAt,
      ],
      client
    );
  }

  async findByDocumentId(
    tenantId: string,
    electronicDocumentId: string,
    client?: PoolClient
  ) {
    const result = await this.query<ElectronicDocumentAttachmentRecord>(
      `SELECT
        a.id,
        a.electronic_document_id,
        a.attachment_type,
        a.provider_attachment_id,
        a.storage_provider,
        a.storage_key,
        a.file_name,
        a.mime_type,
        a.checksum,
        a.size_bytes,
        a.status,
        a.created_at,
        a.updated_at
      FROM electronic_document_attachments a
      INNER JOIN electronic_documents d ON d.id = a.electronic_document_id
      WHERE d.tenant_id = $1
        AND a.electronic_document_id = $2
      ORDER BY a.created_at ASC, a.id ASC`,
      [tenantId, electronicDocumentId],
      client
    );

    return result.rows;
  }

  async findByType(
    tenantId: string,
    electronicDocumentId: string,
    attachmentType: ElectronicDocumentAttachmentType,
    client?: PoolClient
  ) {
    return this.queryOne<ElectronicDocumentAttachmentRecord>(
      `SELECT
        a.id,
        a.electronic_document_id,
        a.attachment_type,
        a.provider_attachment_id,
        a.storage_provider,
        a.storage_key,
        a.file_name,
        a.mime_type,
        a.checksum,
        a.size_bytes,
        a.status,
        a.created_at,
        a.updated_at
      FROM electronic_document_attachments a
      INNER JOIN electronic_documents d ON d.id = a.electronic_document_id
      WHERE d.tenant_id = $1
        AND a.electronic_document_id = $2
        AND a.attachment_type = $3
      LIMIT 1`,
      [tenantId, electronicDocumentId, attachmentType],
      client
    );
  }

  async updateStorageReference(
    tenantId: string,
    attachmentId: string,
    storageProvider: string | null,
    storageKey: string | null,
    status: "PENDING" | "AVAILABLE" | "FAILED" = "AVAILABLE",
    client?: PoolClient
  ) {
    return this.queryOne<ElectronicDocumentAttachmentRecord>(
      `UPDATE electronic_document_attachments a
      SET storage_provider = $3,
          storage_key = $4,
          status = $5,
          updated_at = NOW()
      FROM electronic_documents d
      WHERE a.electronic_document_id = d.id
        AND d.tenant_id = $1
        AND a.id = $2
      RETURNING
        a.id,
        a.electronic_document_id,
        a.attachment_type,
        a.provider_attachment_id,
        a.storage_provider,
        a.storage_key,
        a.file_name,
        a.mime_type,
        a.checksum,
        a.size_bytes,
        a.status,
        a.created_at,
        a.updated_at`,
      [tenantId, attachmentId, storageProvider, storageKey, status],
      client
    );
  }
}

@Injectable()
export class ElectronicDocumentDeliveryRepository extends ElectronicBillingRepositoryBase {
  constructor(@Inject(DatabaseService) db: DatabaseService) {
    super(db);
  }

  async create(input: NewElectronicDocumentDeliveryInput, client?: PoolClient) {
    return this.queryOne<ElectronicDocumentDeliveryRecord>(
      `INSERT INTO electronic_document_deliveries (
        id,
        electronic_document_id,
        delivery_type,
        destination,
        status,
        attempts,
        last_attempt_at,
        sent_at,
        last_error,
        metadata,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING
        id,
        electronic_document_id,
        delivery_type,
        destination,
        status,
        attempts,
        last_attempt_at,
        sent_at,
        last_error,
        metadata,
        created_at,
        updated_at`,
      [
        input.id,
        input.electronicDocumentId,
        input.deliveryType,
        input.destination,
        input.status ?? "PENDING",
        input.attempts ?? 0,
        toDateValue(input.lastAttemptAt),
        toDateValue(input.sentAt),
        input.lastError ?? null,
        input.metadata ?? {},
        input.createdAt,
        input.updatedAt,
      ],
      client
    );
  }

  async findByDocumentId(
    tenantId: string,
    electronicDocumentId: string,
    client?: PoolClient
  ) {
    const result = await this.query<ElectronicDocumentDeliveryRecord>(
      `SELECT
        dly.id,
        dly.electronic_document_id,
        dly.delivery_type,
        dly.destination,
        dly.status,
        dly.attempts,
        dly.last_attempt_at,
        dly.sent_at,
        dly.last_error,
        dly.metadata,
        dly.created_at,
        dly.updated_at
      FROM electronic_document_deliveries dly
      INNER JOIN electronic_documents d ON d.id = dly.electronic_document_id
      WHERE d.tenant_id = $1
        AND dly.electronic_document_id = $2
      ORDER BY dly.created_at ASC, dly.id ASC`,
      [tenantId, electronicDocumentId],
      client
    );

    return result.rows;
  }

  async markAttempt(
    tenantId: string,
    deliveryId: string,
    input: {
      attempts?: number;
      lastAttemptAt?: Date | string | null;
      lastError?: string | null;
    },
    client?: PoolClient
  ) {
    return this.queryOne<ElectronicDocumentDeliveryRecord>(
      `UPDATE electronic_document_deliveries dly
      SET attempts = COALESCE($3, dly.attempts),
          last_attempt_at = COALESCE($4, dly.last_attempt_at),
          last_error = COALESCE($5, dly.last_error),
          updated_at = NOW()
      FROM electronic_documents d
      WHERE dly.electronic_document_id = d.id
        AND d.tenant_id = $1
        AND dly.id = $2
      RETURNING
        dly.id,
        dly.electronic_document_id,
        dly.delivery_type,
        dly.destination,
        dly.status,
        dly.attempts,
        dly.last_attempt_at,
        dly.sent_at,
        dly.last_error,
        dly.metadata,
        dly.created_at,
        dly.updated_at`,
      [tenantId, deliveryId, input.attempts ?? null, toDateValue(input.lastAttemptAt), input.lastError ?? null],
      client
    );
  }

  async markSent(
    tenantId: string,
    deliveryId: string,
    sentAt: Date | string | null = new Date(),
    client?: PoolClient
  ) {
    return this.queryOne<ElectronicDocumentDeliveryRecord>(
      `UPDATE electronic_document_deliveries dly
      SET status = 'SENT',
          sent_at = COALESCE($3, dly.sent_at),
          updated_at = NOW()
      FROM electronic_documents d
      WHERE dly.electronic_document_id = d.id
        AND d.tenant_id = $1
        AND dly.id = $2
      RETURNING
        dly.id,
        dly.electronic_document_id,
        dly.delivery_type,
        dly.destination,
        dly.status,
        dly.attempts,
        dly.last_attempt_at,
        dly.sent_at,
        dly.last_error,
        dly.metadata,
        dly.created_at,
        dly.updated_at`,
      [tenantId, deliveryId, toDateValue(sentAt)],
      client
    );
  }

  async markFailed(
    tenantId: string,
    deliveryId: string,
    lastError: string,
    client?: PoolClient
  ) {
    return this.queryOne<ElectronicDocumentDeliveryRecord>(
      `UPDATE electronic_document_deliveries dly
      SET status = 'FAILED',
          last_error = $3,
          updated_at = NOW()
      FROM electronic_documents d
      WHERE dly.electronic_document_id = d.id
        AND d.tenant_id = $1
        AND dly.id = $2
      RETURNING
        dly.id,
        dly.electronic_document_id,
        dly.delivery_type,
        dly.destination,
        dly.status,
        dly.attempts,
        dly.last_attempt_at,
        dly.sent_at,
        dly.last_error,
        dly.metadata,
        dly.created_at,
        dly.updated_at`,
      [tenantId, deliveryId, lastError],
      client
    );
  }
}

export { ElectronicDocumentConflictError };
