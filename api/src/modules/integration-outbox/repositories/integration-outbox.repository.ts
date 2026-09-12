import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import {
  IntegrationOutboxConflictError,
} from "../contracts/integration-outbox.errors";
import type {
  SaleCompletedForElectronicBillingEventEnvelope,
} from "../contracts/integration-outbox-events";

export type IntegrationOutboxEventStatus = "PENDING" | "PROCESSING" | "PUBLISHED" | "FAILED";

export type IntegrationOutboxEventRecord = QueryResultRow & {
  id: string;
  event_id: string;
  event_type: string;
  schema_version: number;
  tenant_id: string;
  correlation_id: string;
  source_type: string;
  source_id: string;
  payload: SaleCompletedForElectronicBillingEventEnvelope["payload"];
  payload_hash: string;
  status: IntegrationOutboxEventStatus;
  attempt_count: number;
  next_attempt_at: string | Date;
  lease_until: string | Date | null;
  last_attempt_at: string | Date | null;
  published_at: string | Date | null;
  last_error: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

export type NewIntegrationOutboxEventInput = {
  id: string;
  event: SaleCompletedForElectronicBillingEventEnvelope;
  payloadHash?: string;
  status?: IntegrationOutboxEventStatus;
  attemptCount?: number;
  nextAttemptAt?: Date | string;
  leaseUntil?: Date | string | null;
  lastAttemptAt?: Date | string | null;
  publishedAt?: Date | string | null;
  lastError?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export type ClaimDueIntegrationOutboxEventsInput = {
  now: Date;
  limit: number;
  leaseMs: number;
};

const toIso = (value: Date | string | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((accumulator, key) => {
      accumulator[key] = canonicalize((value as Record<string, unknown>)[key]);
      return accumulator;
    }, {});
};

const stableStringify = (value: unknown) => JSON.stringify(canonicalize(value));

const readResultRow = (result: { rows: IntegrationOutboxEventRecord[] }) =>
  result.rows[0] ?? null;

@Injectable()
export class IntegrationOutboxRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  private async query<T extends QueryResultRow>(
    text: string,
    params: unknown[] = [],
    client?: PoolClient,
  ) {
    if (client) {
      return client.query<T>(text, params);
    }

    return this.db.query<T>(text, params);
  }

  private mapRecord(row: IntegrationOutboxEventRecord): IntegrationOutboxEventRecord {
    return row;
  }

  hashPayload(payload: unknown) {
    return createHash("sha256").update(stableStringify(payload) ?? "").digest("hex");
  }

  async enqueue(
    input: NewIntegrationOutboxEventInput,
    client?: PoolClient,
  ): Promise<IntegrationOutboxEventRecord> {
    const payloadHash = input.payloadHash ?? this.hashPayload(input.event.payload);
    const inserted = await this.query<IntegrationOutboxEventRecord>(
      `INSERT INTO integration_outbox_events (
        id,
        event_id,
        event_type,
        schema_version,
        tenant_id,
        correlation_id,
        source_type,
        source_id,
        payload,
        payload_hash,
        status,
        attempt_count,
        next_attempt_at,
        lease_until,
        last_attempt_at,
        published_at,
        last_error,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      ON CONFLICT (event_id) DO NOTHING
      RETURNING
        id,
        event_id,
        event_type,
        schema_version,
        tenant_id,
        correlation_id,
        source_type,
        source_id,
        payload,
        payload_hash,
        status,
        attempt_count,
        next_attempt_at,
        lease_until,
        last_attempt_at,
        published_at,
        last_error,
        created_at,
        updated_at`,
      [
        input.id,
        input.event.eventId,
        input.event.eventType,
        input.event.schemaVersion,
        input.event.tenantId,
        input.event.correlationId,
        input.event.source.type,
        input.event.source.id,
        JSON.stringify(input.event.payload),
        payloadHash,
        input.status ?? "PENDING",
        input.attemptCount ?? 0,
        toIso(input.nextAttemptAt ?? input.createdAt ?? new Date()) ?? new Date().toISOString(),
        toIso(input.leaseUntil),
        toIso(input.lastAttemptAt),
        toIso(input.publishedAt),
        input.lastError ?? null,
        toIso(input.createdAt ?? new Date()) ?? new Date().toISOString(),
        toIso(input.updatedAt ?? new Date()) ?? new Date().toISOString(),
      ],
      client,
    );

    const row = readResultRow(inserted);
    if (row) {
      return this.mapRecord(row);
    }

    const existing = await this.findByEventId(input.event.eventId, client);
    if (!existing) {
      throw new IntegrationOutboxConflictError(
        `Outbox event ${input.event.eventId} already exists but could not be loaded`,
      );
    }

    if (existing.payload_hash !== payloadHash) {
      throw new IntegrationOutboxConflictError(
        `Outbox event ${input.event.eventId} already exists with a different payload`,
      );
    }

    return existing;
  }

  async findByEventId(
    eventId: string,
    client?: PoolClient,
  ): Promise<IntegrationOutboxEventRecord | null> {
    const result = await this.query<IntegrationOutboxEventRecord>(
      `SELECT
        id,
        event_id,
        event_type,
        schema_version,
        tenant_id,
        correlation_id,
        source_type,
        source_id,
        payload,
        payload_hash,
        status,
        attempt_count,
        next_attempt_at,
        lease_until,
        last_attempt_at,
        published_at,
        last_error,
        created_at,
        updated_at
      FROM integration_outbox_events
      WHERE event_id = $1
      LIMIT 1`,
      [eventId],
      client,
    );

    return result.rows[0] ?? null;
  }

  async findBySource(
    tenantId: string,
    sourceType: string,
    sourceId: string,
    eventType: string,
    client?: PoolClient,
  ): Promise<IntegrationOutboxEventRecord[]> {
    const result = await this.query<IntegrationOutboxEventRecord>(
      `SELECT
        id, event_id, event_type, schema_version, tenant_id, correlation_id,
        source_type, source_id, payload, payload_hash, status, attempt_count,
        next_attempt_at, lease_until, last_attempt_at, published_at,
        last_error, created_at, updated_at
       FROM integration_outbox_events
       WHERE tenant_id = $1
         AND source_type = $2
         AND source_id = $3
         AND event_type = $4
       ORDER BY created_at DESC, id DESC
       FOR UPDATE`,
      [tenantId, sourceType, sourceId, eventType],
      client,
    );

    return result.rows ?? [];
  }

  async supersedePendingEvent(
    eventId: string,
    replacementEventId: string,
    supersededAt: Date,
    client?: PoolClient,
  ): Promise<boolean> {
    const result = await this.query<QueryResultRow>(
      `UPDATE integration_outbox_events
       SET
         status = 'FAILED',
         lease_until = NULL,
         next_attempt_at = $3,
         last_error = $2,
         updated_at = $3
       WHERE event_id = $1
         AND event_type = 'SALE_COMPLETED_FOR_ELECTRONIC_BILLING'
         AND status = 'PENDING'
         AND attempt_count = 0
         AND lease_until IS NULL
       RETURNING event_id`,
      [
        eventId,
        JSON.stringify({
          code: "OUTBOX_EVENT_SUPERSEDED",
          replacementEventId,
        }),
        supersededAt.toISOString(),
      ],
      client,
    );

    return result.rows.length === 1;
  }

  async claimDueEvents(
    input: ClaimDueIntegrationOutboxEventsInput,
    client?: PoolClient,
  ): Promise<IntegrationOutboxEventRecord[]> {
    const leaseUntil = new Date(input.now.getTime() + input.leaseMs);
    const result = await this.query<IntegrationOutboxEventRecord>(
      `WITH candidates AS (
        SELECT id
        FROM integration_outbox_events
        WHERE (
          (status = 'PENDING' AND next_attempt_at <= $1)
          OR (status = 'PROCESSING' AND lease_until <= $1)
        )
          AND (lease_until IS NULL OR lease_until <= $1)
        ORDER BY created_at ASC, id ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      )
      UPDATE integration_outbox_events AS event
      SET
        status = 'PROCESSING',
        attempt_count = event.attempt_count + 1,
        lease_until = $3,
        last_attempt_at = $1,
        updated_at = $1
      FROM candidates
      WHERE event.id = candidates.id
      RETURNING
        event.id,
        event.event_id,
        event.event_type,
        event.schema_version,
        event.tenant_id,
        event.correlation_id,
        event.source_type,
        event.source_id,
        event.payload,
        event.payload_hash,
        event.status,
        event.attempt_count,
        event.next_attempt_at,
        event.lease_until,
        event.last_attempt_at,
        event.published_at,
        event.last_error,
        event.created_at,
        event.updated_at`,
      [input.now.toISOString(), input.limit, leaseUntil.toISOString()],
      client,
    );

    return result.rows ?? [];
  }

  async claimDueEvent(
    eventId: string,
    input: ClaimDueIntegrationOutboxEventsInput,
    client?: PoolClient,
  ): Promise<IntegrationOutboxEventRecord | null> {
    const leaseUntil = new Date(input.now.getTime() + input.leaseMs);
    const result = await this.query<IntegrationOutboxEventRecord>(
      `UPDATE integration_outbox_events AS event
       SET
         status = 'PROCESSING',
         attempt_count = event.attempt_count + 1,
         lease_until = $2,
         last_attempt_at = $3,
         updated_at = $3
       WHERE event.event_id = $1
         AND event.status = 'PENDING'
         AND event.next_attempt_at <= $3
         AND (event.lease_until IS NULL OR event.lease_until <= $3)
       RETURNING
         event.id, event.event_id, event.event_type, event.schema_version,
         event.tenant_id, event.correlation_id, event.source_type, event.source_id,
         event.payload, event.payload_hash, event.status, event.attempt_count,
         event.next_attempt_at, event.lease_until, event.last_attempt_at,
         event.published_at, event.last_error, event.created_at, event.updated_at`,
      [eventId, leaseUntil.toISOString(), input.now.toISOString()],
      client,
    );

    return result.rows[0] ?? null;
  }

  async markPublished(
    eventId: string,
    publishedAt: Date,
    client?: PoolClient,
  ) {
    await this.query<QueryResultRow>(
      `UPDATE integration_outbox_events
       SET
         status = 'PUBLISHED',
         published_at = $2,
         lease_until = NULL,
         last_error = NULL,
         updated_at = $2
       WHERE event_id = $1`,
      [eventId, publishedAt.toISOString()],
      client,
    );
  }

  async markRetryableFailure(
    eventId: string,
    input: {
      nextAttemptAt: Date;
      lastError: string;
    },
    client?: PoolClient,
  ) {
    await this.query<QueryResultRow>(
      `UPDATE integration_outbox_events
       SET
         status = 'PENDING',
         next_attempt_at = $2,
         lease_until = NULL,
         last_error = $3,
         updated_at = $2
       WHERE event_id = $1`,
      [eventId, input.nextAttemptAt.toISOString(), input.lastError],
      client,
    );
  }

  async markTerminalFailure(
    eventId: string,
    input: {
      lastError: string;
      failedAt?: Date;
    },
    client?: PoolClient,
  ) {
    const failedAt = input.failedAt ?? new Date();
    await this.query<QueryResultRow>(
      `UPDATE integration_outbox_events
       SET
         status = 'FAILED',
         lease_until = NULL,
         next_attempt_at = $2,
         last_error = $3,
         updated_at = $2
       WHERE event_id = $1`,
      [eventId, failedAt.toISOString(), input.lastError],
      client,
    );
  }

  async reactivateForRetry(
    eventId: string,
    client?: PoolClient,
  ): Promise<IntegrationOutboxEventRecord | null> {
    const now = new Date();
    const result = await this.query<IntegrationOutboxEventRecord>(
      `UPDATE integration_outbox_events
       SET
         status = 'PENDING',
         attempt_count = attempt_count,
         next_attempt_at = $2,
         lease_until = NULL,
         last_error = NULL,
         updated_at = $2
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
         payload,
         payload_hash,
         status,
         attempt_count,
         next_attempt_at,
         lease_until,
         last_attempt_at,
         published_at,
         last_error,
         created_at,
         updated_at`,
      [eventId, now.toISOString()],
      client,
    );

    return result.rows[0] ?? null;
  }
}
