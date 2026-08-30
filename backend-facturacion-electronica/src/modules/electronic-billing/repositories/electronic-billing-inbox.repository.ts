import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../database/database.service";
import type {
  ElectronicBillingInboxEventRecord,
  ElectronicBillingInboxEventStatus,
  NewElectronicBillingInboxEventInput,
} from "./electronic-billing-records";

const toDateValue = (value: Date | string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
};

@Injectable()
export class ElectronicBillingInboxRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
  ) {}

  async findByEventId(eventId: string, client?: PoolClient) {
    return this.queryOne<ElectronicBillingInboxEventRecord>(
      `SELECT
        id,
        event_id,
        event_type,
        schema_version,
        tenant_id,
        correlation_id,
        source_type,
        source_id,
        external_reference,
        payload_hash,
        payload,
        status,
        electronic_document_id,
        received_at,
        processed_at,
        last_error_code,
        last_error_message,
        created_at,
        updated_at
      FROM electronic_billing_inbox_events
      WHERE event_id = $1
      LIMIT 1`,
      [eventId],
      client,
    );
  }

  async findBySource(
    tenantId: string,
    sourceType: ElectronicBillingInboxEventRecord["source_type"],
    sourceId: string,
    client?: PoolClient,
  ) {
    return this.queryOne<ElectronicBillingInboxEventRecord>(
      `SELECT
        id,
        event_id,
        event_type,
        schema_version,
        tenant_id,
        correlation_id,
        source_type,
        source_id,
        external_reference,
        payload_hash,
        payload,
        status,
        electronic_document_id,
        received_at,
        processed_at,
        last_error_code,
        last_error_message,
        created_at,
        updated_at
      FROM electronic_billing_inbox_events
      WHERE tenant_id = $1
        AND source_type = $2
        AND source_id = $3
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
      [tenantId, sourceType, sourceId],
      client,
    );
  }

  async insertReceived(
    input: NewElectronicBillingInboxEventInput,
    client?: PoolClient,
  ) {
    return this.queryOne<ElectronicBillingInboxEventRecord>(
      `INSERT INTO electronic_billing_inbox_events (
        id,
        event_id,
        event_type,
        schema_version,
        tenant_id,
        correlation_id,
        source_type,
        source_id,
        external_reference,
        payload_hash,
        payload,
        status,
        electronic_document_id,
        received_at,
        processed_at,
        last_error_code,
        last_error_message,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      ON CONFLICT DO NOTHING
      RETURNING
        id,
        event_id,
        event_type,
        schema_version,
        tenant_id,
        correlation_id,
        source_type,
        source_id,
        external_reference,
        payload_hash,
        payload,
        status,
        electronic_document_id,
        received_at,
        processed_at,
        last_error_code,
        last_error_message,
        created_at,
        updated_at`,
      [
        input.id,
        input.eventId,
        input.eventType,
        input.schemaVersion,
        input.tenantId,
        input.correlationId,
        input.sourceType,
        input.sourceId,
        input.externalReference,
        input.payloadHash,
        input.payload,
        input.status ?? "RECEIVED",
        input.electronicDocumentId ?? null,
        toDateValue(input.receivedAt) ?? new Date(),
        toDateValue(input.processedAt) ?? null,
        input.lastErrorCode ?? null,
        input.lastErrorMessage ?? null,
        toDateValue(input.createdAt) ?? new Date(),
        toDateValue(input.updatedAt) ?? new Date(),
      ],
      client,
    );
  }

  async markProcessed(
    eventId: string,
    input: {
      electronicDocumentId: string;
      processedAt?: Date | string;
    },
    client?: PoolClient,
  ) {
    return this.queryOne<ElectronicBillingInboxEventRecord>(
      `UPDATE electronic_billing_inbox_events
      SET status = 'PROCESSED',
          electronic_document_id = $2,
          processed_at = COALESCE($3, NOW()),
          last_error_code = NULL,
          last_error_message = NULL,
          updated_at = NOW()
      WHERE event_id = $1
      RETURNING
        id,
        event_id,
        event_type,
        schema_version,
        tenant_id,
        correlation_id,
        source_type,
        source_id,
        external_reference,
        payload_hash,
        payload,
        status,
        electronic_document_id,
        received_at,
        processed_at,
        last_error_code,
        last_error_message,
        created_at,
        updated_at`,
      [eventId, input.electronicDocumentId, toDateValue(input.processedAt)],
      client,
    );
  }

  async markFailed(
    eventId: string,
    input: {
      errorCode: string;
      errorMessage: string;
      status?: ElectronicBillingInboxEventStatus;
    },
    client?: PoolClient,
  ) {
    return this.queryOne<ElectronicBillingInboxEventRecord>(
      `UPDATE electronic_billing_inbox_events
      SET status = $2,
          last_error_code = $3,
          last_error_message = $4,
          updated_at = NOW()
      WHERE event_id = $1
      RETURNING
        id,
        event_id,
        event_type,
        schema_version,
        tenant_id,
        correlation_id,
        source_type,
        source_id,
        external_reference,
        payload_hash,
        payload,
        status,
        electronic_document_id,
        received_at,
        processed_at,
        last_error_code,
        last_error_message,
        created_at,
        updated_at`,
      [
        eventId,
        input.status ?? "FAILED",
        input.errorCode,
        input.errorMessage,
      ],
      client,
    );
  }

  private async queryOne<T extends Record<string, unknown>>(
    text: string,
    params: unknown[] = [],
    client?: PoolClient,
  ): Promise<T | null> {
    const result = client
      ? await client.query<T>(text, params)
      : await this.db.query<T>(text, params);

    return result.rows[0] ?? null;
  }
}
