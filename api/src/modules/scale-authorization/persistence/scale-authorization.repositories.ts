import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import { verifierFor } from "../domain/agent-credential.domain";
import {
  assertBindingInvariant,
  authorizeScaleBinding,
  type KgOperatorConfirmation,
  type ScaleBinding,
  type ScaleBindingContext,
} from "../domain/scale-binding.domain";
import {
  createWeightCapture,
  consumeWeightCapture,
  markCaptureReady,
  type WeightCapture,
  type WeightCaptureContext,
  type WeightObservation,
} from "../domain/weight-capture.domain";

// Mutations require a caller-owned transaction client; no repository is wired
// to a productive module during this foundation phase.
type Queryable = Pick<PoolClient, "query">;

@Injectable()
export class AgentCredentialPersistence {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async issue(client: Queryable, input: {
    tenantId: string;
    terminalDeviceId: string;
    credentialId: string;
    secret: string;
    expiresAt: Date;
    actorId: string;
  }) {
    if (!input.secret || !input.credentialId || !input.actorId
      || !Number.isFinite(input.expiresAt?.getTime()) || input.expiresAt.getTime() <= Date.now()) {
      throw new Error("CREDENTIAL_INPUT_INVALID");
    }
    await client.query(
      `UPDATE terminal_device_credentials SET status = 'EXPIRED'
       WHERE tenant_id = $1 AND terminal_device_id = $2 AND status = 'ACTIVE'
         AND expires_at IS NOT NULL AND expires_at <= now()`,
      [input.tenantId, input.terminalDeviceId],
    );
    const result = await client.query<QueryResultRow & { id: string; verifier_version: string; status: string }>(
      `INSERT INTO terminal_device_credentials
        (tenant_id, terminal_device_id, credential_id, verifier_version, verifier_sha256,
         status, issued_at, expires_at, created_by)
       SELECT d.tenant_id, d.id, $3, 'sha256-v1', $4, 'ACTIVE', now(), $5, $6
       FROM terminal_devices d
       WHERE d.tenant_id = $1 AND d.id = $2 AND d.registration_status <> 'REVOKED'
       RETURNING id, verifier_version, status`,
      [input.tenantId, input.terminalDeviceId, input.credentialId, verifierFor(input.secret), input.expiresAt, input.actorId],
    );
    return result.rows[0] ?? null;
  }

  async findActive(client: Queryable, tenantId: string, terminalDeviceId: string, credentialId: string) {
    const result = await client.query<QueryResultRow & { verifier_sha256: string; expires_at: Date | null; revoked_at: Date | null }>(
      `SELECT verifier_sha256, expires_at, revoked_at
       FROM terminal_device_credentials
       WHERE tenant_id = $1 AND terminal_device_id = $2 AND credential_id = $3
         AND status = 'ACTIVE' AND expires_at > now()
         AND EXISTS (SELECT 1 FROM terminal_devices d WHERE d.id = terminal_device_credentials.terminal_device_id
           AND d.tenant_id = terminal_device_credentials.tenant_id AND d.registration_status <> 'REVOKED')
       FOR UPDATE`,
      [tenantId, terminalDeviceId, credentialId],
    );
    return result.rows[0] ?? null;
  }

  async revoke(client: Queryable, tenantId: string, credentialId: string, actorId: string) {
    const result = await client.query<QueryResultRow & { id: string; status: string }>(
      `UPDATE terminal_device_credentials
       SET status = 'REVOKED', revoked_at = now(), revoked_by = $3
       WHERE tenant_id = $1 AND credential_id = $2 AND status = 'ACTIVE'
       RETURNING id, status`,
      [tenantId, credentialId, actorId],
    );
    return result.rows[0] ?? null;
  }

  async expireDue(client: Queryable, now = new Date()) {
    const result = await client.query<QueryResultRow & { id: string }>(
      `UPDATE terminal_device_credentials SET status = 'EXPIRED'
       WHERE status = 'ACTIVE' AND expires_at IS NOT NULL AND expires_at <= $1
       RETURNING id`, [now],
    );
    return result.rows;
  }

  async rotate(client: Queryable, input: {
    tenantId: string; terminalDeviceId: string; credentialId: string;
    nextCredentialId: string; nextSecret: string; expiresAt: Date; actorId: string;
  }) {
    if (!input.nextSecret || !input.actorId) throw new Error("CREDENTIAL_INPUT_INVALID");
    const retired = await client.query<QueryResultRow>(
      `UPDATE terminal_device_credentials
       SET status = 'ROTATED', rotated_at = now(), rotated_by = $4
       WHERE tenant_id = $1 AND terminal_device_id = $2 AND credential_id = $3 AND status = 'ACTIVE'
       RETURNING id`,
      [input.tenantId, input.terminalDeviceId, input.credentialId, input.actorId],
    );
    if (retired.rowCount !== 1) throw new Error("ACTIVE_CREDENTIAL_NOT_FOUND");
    return this.issue(client, {
      tenantId: input.tenantId, terminalDeviceId: input.terminalDeviceId,
      credentialId: input.nextCredentialId, secret: input.nextSecret,
      expiresAt: input.expiresAt, actorId: input.actorId,
    });
  }
}

type BindingRow = QueryResultRow & {
  id: string; tenant_id: string; branch_id: string; pos_terminal_id: string;
  operational_terminal_id: string; terminal_device_id: string; logical_scale_id: string;
  status: ScaleBinding["status"]; unit_state: ScaleBinding["unitState"];
  unit_verification_method: "OPERATOR_CONFIRMATION" | null; unit_verification_unit: "kg" | null;
  unit_verified_by_user_id: string | null; verified_at: Date | null;
};

const bindingContextFrom = (row: BindingRow): ScaleBindingContext => ({
  tenantId: row.tenant_id, branchId: row.branch_id, posTerminalId: row.pos_terminal_id,
  operationalTerminalId: row.operational_terminal_id, terminalDeviceId: row.terminal_device_id,
  logicalScaleId: row.logical_scale_id,
});

const bindingFrom = (row: BindingRow): ScaleBinding => ({
  id: row.id, ...bindingContextFrom(row), status: row.status, unitState: row.unit_state,
  ...(row.unit_state === "KG_VERIFIED" && row.unit_verified_by_user_id && row.verified_at
    ? { unitVerification: {
      method: row.unit_verification_method ?? "OPERATOR_CONFIRMATION", unit: row.unit_verification_unit ?? "kg",
      operatorId: row.unit_verified_by_user_id, verifiedAt: new Date(row.verified_at).toISOString(),
    } }
    : {}),
});

@Injectable()
export class ScaleBindingPersistence {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async createPending(client: Queryable, context: ScaleBindingContext, actorId: string) {
    const result = await client.query<QueryResultRow & { id: string; status: string; unit_state: string }>(
      `INSERT INTO terminal_scale_bindings
        (tenant_id, branch_id, pos_terminal_id, operational_terminal_id, terminal_device_id,
         logical_scale_id, status, unit_state, created_by)
       SELECT p.tenant_id, p.branch_id, p.id, t.id, d.id, $6, 'PENDING', 'NOT_VERIFIED', $7
       FROM pos_terminals p
       JOIN terminals t ON t.id = $4 AND t.tenant_id = p.tenant_id AND t.branch_id = p.branch_id AND t.is_active = true
       JOIN terminal_devices d ON d.id = $5 AND d.tenant_id = p.tenant_id AND d.registration_status <> 'REVOKED'
       WHERE p.tenant_id = $1 AND p.branch_id = $2 AND p.id = $3 AND p.active = true
       RETURNING id, status, unit_state`,
      [context.tenantId, context.branchId, context.posTerminalId, context.operationalTerminalId,
        context.terminalDeviceId, context.logicalScaleId, actorId],
    );
    return result.rows[0] ?? null;
  }

  async findForUpdate(client: Queryable, tenantId: string, bindingId: string): Promise<ScaleBinding | null> {
    const result = await client.query<BindingRow>(
      `SELECT * FROM terminal_scale_bindings WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
      [tenantId, bindingId],
    );
    return result.rows[0] ? bindingFrom(result.rows[0]) : null;
  }

  async authorize(client: Queryable, input: {
    tenantId: string; bindingId: string; expectedContext: ScaleBindingContext;
    confirmation: KgOperatorConfirmation;
  }) {
    const row = await this.findForUpdate(client, input.tenantId, input.bindingId);
    if (!row) throw new Error("SCALE_BINDING_NOT_FOUND");
    const authorized = authorizeScaleBinding(row, input.confirmation, input.expectedContext);
    assertBindingInvariant(authorized);
    const result = await client.query<QueryResultRow & { id: string; status: string; unit_state: string }>(
      `UPDATE terminal_scale_bindings
       SET status = 'AUTHORIZED', unit_state = 'KG_VERIFIED',
           unit_verification_method = 'OPERATOR_CONFIRMATION', unit_verification_unit = 'kg',
           unit_verified_by_user_id = $3, verified_at = $4
       WHERE tenant_id = $1 AND id = $2 AND status = 'PENDING' AND unit_state = 'NOT_VERIFIED'
         AND branch_id = $5 AND pos_terminal_id = $6 AND operational_terminal_id = $7
         AND terminal_device_id = $8 AND logical_scale_id = $9
       RETURNING id, status, unit_state`,
      [input.tenantId, input.bindingId, input.confirmation.operatorId, input.confirmation.confirmedAt,
        input.expectedContext.branchId, input.expectedContext.posTerminalId,
        input.expectedContext.operationalTerminalId, input.expectedContext.terminalDeviceId,
        input.expectedContext.logicalScaleId],
    );
    if (result.rowCount !== 1) throw new Error("SCALE_BINDING_CONTEXT_MISMATCH");
    return result.rows[0];
  }

  async revoke(client: Queryable, tenantId: string, bindingId: string, actorId: string) {
    const result = await client.query<QueryResultRow>(
      `UPDATE terminal_scale_bindings SET status = 'REVOKED', revoked_at = now(), revoked_by = $3
       WHERE tenant_id = $1 AND id = $2 AND status IN ('PENDING', 'AUTHORIZED')
       RETURNING id, status`,
      [tenantId, bindingId, actorId],
    );
    if (result.rowCount === 1) {
      await client.query(
        `UPDATE terminal_scale_weight_captures SET status = 'REJECTED'
         WHERE tenant_id = $1 AND terminal_scale_binding_id = $2 AND status IN ('PENDING','READY')`,
        [tenantId, bindingId],
      );
    }
    return result.rows[0] ?? null;
  }

  async disable(client: Queryable, tenantId: string, bindingId: string) {
    const result = await client.query<QueryResultRow>(
      `UPDATE terminal_scale_bindings SET status = 'DISABLED'
       WHERE tenant_id = $1 AND id = $2 AND status IN ('PENDING', 'AUTHORIZED')
       RETURNING id, status`, [tenantId, bindingId],
    );
    if (result.rowCount === 1) {
      await client.query(
        `UPDATE terminal_scale_weight_captures SET status = 'REJECTED'
         WHERE tenant_id = $1 AND terminal_scale_binding_id = $2 AND status IN ('PENDING','READY')`,
        [tenantId, bindingId],
      );
    }
    return result.rows[0] ?? null;
  }
}

export type CaptureScope = WeightCaptureContext & { terminalDeviceId: string };
type CaptureRow = QueryResultRow & {
  capture_id: string; tenant_id: string; branch_id: string; pos_terminal_id: string;
  operational_terminal_id: string; pos_session_id: string; product_id: string;
  logical_scale_id: string; terminal_scale_binding_id: string; nonce_verifier_sha256: string;
  weight_kg: string | number | null; measurement_source: "REAL" | null;
  measurement_unit: "kg" | null; unit_verified: boolean | null; observed_at: Date | null;
  status: WeightCapture["status"]; expires_at: Date;
};

const captureDomainValue = (row: CaptureRow): WeightCapture => ({
  captureId: row.capture_id,
  tenantId: row.tenant_id,
  branchId: row.branch_id,
  posTerminalId: row.pos_terminal_id,
  operationalTerminalId: row.operational_terminal_id,
  posSessionId: row.pos_session_id,
  productId: row.product_id,
  logicalScaleId: row.logical_scale_id,
  bindingId: row.terminal_scale_binding_id,
  nonceVerifier: row.nonce_verifier_sha256,
  status: row.status,
  expiresAt: new Date(row.expires_at).toISOString(),
  ...(row.weight_kg !== null && row.measurement_source && row.measurement_unit && row.unit_verified && row.observed_at
    ? { observation: {
      source: row.measurement_source, value: Number(row.weight_kg), unit: row.measurement_unit,
      unitVerified: row.unit_verified, observedAt: new Date(row.observed_at).toISOString(),
    } }
    : {}),
});

@Injectable()
export class WeightCapturePersistence {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async lockReadyForSale(client: Queryable, input: {
    captureId: string;
    nonce: string;
    expected: Pick<CaptureScope, "tenantId" | "branchId" | "posTerminalId" | "operationalTerminalId" | "posSessionId" | "productId">;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const result = await client.query<CaptureRow>(
      `SELECT c.*
       FROM terminal_scale_weight_captures c
       JOIN terminal_scale_bindings b
         ON b.id = c.terminal_scale_binding_id
        AND b.tenant_id = c.tenant_id
        AND b.branch_id = c.branch_id
        AND b.pos_terminal_id = c.pos_terminal_id
        AND b.operational_terminal_id = c.operational_terminal_id
        AND b.terminal_device_id = c.terminal_device_id
        AND b.logical_scale_id = c.logical_scale_id
       JOIN terminal_devices d
         ON d.id = c.terminal_device_id AND d.tenant_id = c.tenant_id
       JOIN pos_terminals p
         ON p.id = c.pos_terminal_id
        AND p.tenant_id = c.tenant_id
        AND p.branch_id = c.branch_id
        AND p.operational_terminal_id = c.operational_terminal_id
       WHERE c.capture_id = $1
         AND c.nonce_verifier_sha256 = $2
         AND c.tenant_id = $3
         AND c.branch_id = $4
         AND c.pos_terminal_id = $5
         AND c.operational_terminal_id = $6
         AND c.pos_session_id = $7
         AND c.product_id = $8
         AND c.status = 'READY'
         AND c.expires_at > $9
         AND c.measurement_source = 'REAL'
         AND c.measurement_unit = 'kg'
         AND c.unit_verified IS TRUE
         AND c.weight_kg IS NOT NULL
         AND c.weight_kg > 0
         AND c.observed_at IS NOT NULL
         AND b.status = 'AUTHORIZED'
         AND b.unit_state = 'KG_VERIFIED'
         AND d.registration_status <> 'REVOKED'
         AND p.active IS TRUE
       FOR UPDATE OF c
       FOR SHARE OF b, d, p`,
      [input.captureId, verifierFor(input.nonce), input.expected.tenantId,
        input.expected.branchId, input.expected.posTerminalId,
        input.expected.operationalTerminalId, input.expected.posSessionId,
        input.expected.productId, now],
    );
    if (result.rowCount !== 1) throw new Error("CAPTURE_NOT_READY_FOR_SALE");

    const row = result.rows[0];
    const context: WeightCaptureContext = {
      tenantId: input.expected.tenantId,
      branchId: input.expected.branchId,
      posTerminalId: input.expected.posTerminalId,
      operationalTerminalId: input.expected.operationalTerminalId,
      posSessionId: input.expected.posSessionId,
      productId: input.expected.productId,
      logicalScaleId: row.logical_scale_id,
      bindingId: row.terminal_scale_binding_id,
    };
    consumeWeightCapture(captureDomainValue(row), input.nonce, context, now);
    return {
      captureId: row.capture_id,
      weightKg: String(row.weight_kg),
      scope: {
        ...context,
        terminalDeviceId: row.terminal_device_id,
      } satisfies CaptureScope,
    };
  }

  async createPending(client: Queryable, scope: CaptureScope, ttlMs: number, now = new Date()) {
    const issued = createWeightCapture(scope, ttlMs, now);
    const binding = await client.query<QueryResultRow>(
      `SELECT id FROM terminal_scale_bindings
       WHERE id = $1 AND tenant_id = $2 AND branch_id = $3 AND pos_terminal_id = $4
         AND operational_terminal_id = $5 AND logical_scale_id = $6 AND terminal_device_id = $7
         AND status = 'AUTHORIZED' AND unit_state = 'KG_VERIFIED'
       FOR SHARE`,
      [scope.bindingId, scope.tenantId, scope.branchId, scope.posTerminalId,
        scope.operationalTerminalId, scope.logicalScaleId, scope.terminalDeviceId],
    );
    if (binding.rowCount !== 1) throw new Error("AUTHORIZED_SCALE_BINDING_REQUIRED");
    const result = await client.query<QueryResultRow & { capture_id: string; nonce_verifier_sha256: string; expires_at: Date }>(
      `INSERT INTO terminal_scale_weight_captures
        (capture_id, tenant_id, branch_id, pos_terminal_id, operational_terminal_id, pos_session_id,
         product_id, terminal_device_id, logical_scale_id, terminal_scale_binding_id,
         nonce_verifier_sha256, status, created_at, expires_at)
       SELECT $1, b.tenant_id, b.branch_id, b.pos_terminal_id, b.operational_terminal_id, $2,
         $3, b.terminal_device_id, b.logical_scale_id, b.id, $4, 'PENDING', $5, $6
       FROM terminal_scale_bindings b
       WHERE b.id = $7 AND b.tenant_id = $8 AND b.branch_id = $9 AND b.pos_terminal_id = $10
         AND b.operational_terminal_id = $11 AND b.logical_scale_id = $12
         AND b.status = 'AUTHORIZED' AND b.unit_state = 'KG_VERIFIED'
         AND b.terminal_device_id = $13
       RETURNING capture_id, nonce_verifier_sha256, expires_at`,
      [issued.capture.captureId, scope.posSessionId, scope.productId, issued.capture.nonceVerifier,
        now, issued.capture.expiresAt, scope.bindingId, scope.tenantId, scope.branchId,
        scope.posTerminalId, scope.operationalTerminalId, scope.logicalScaleId, scope.terminalDeviceId],
    );
    if (result.rowCount !== 1) throw new Error("AUTHORIZED_SCALE_BINDING_REQUIRED");
    return { captureId: result.rows[0].capture_id, nonce: issued.nonce, expiresAt: result.rows[0].expires_at };
  }

  async markReady(client: Queryable, input: {
    captureId: string; observation: WeightObservation; now?: Date;
  }) {
    const now = input.now ?? new Date();
    if (input.observation.source !== "REAL" || input.observation.unit !== "kg" || !input.observation.unitVerified
      || !Number.isFinite(input.observation.value) || input.observation.value < 0
      || !Number.isFinite(Date.parse(input.observation.observedAt))) {
      throw new Error("CAPTURE_OBSERVATION_NOT_COMMERCIAL");
    }
    const identity = await client.query<QueryResultRow & { tenant_id: string; branch_id: string; pos_terminal_id: string; operational_terminal_id: string; terminal_device_id: string; logical_scale_id: string; terminal_scale_binding_id: string }>(
      `SELECT tenant_id, branch_id, pos_terminal_id, operational_terminal_id, terminal_device_id,
         logical_scale_id, terminal_scale_binding_id
       FROM terminal_scale_weight_captures WHERE capture_id = $1`, [input.captureId],
    );
    if (identity.rowCount !== 1) throw new Error("CAPTURE_NOT_FOUND");
    const scope = identity.rows[0];
    const binding = await client.query<QueryResultRow>(
      `SELECT id FROM terminal_scale_bindings
       WHERE id = $1 AND tenant_id = $2 AND branch_id = $3 AND pos_terminal_id = $4
         AND operational_terminal_id = $5 AND terminal_device_id = $6 AND logical_scale_id = $7
         AND status = 'AUTHORIZED' AND unit_state = 'KG_VERIFIED' FOR SHARE`,
      [scope.terminal_scale_binding_id, scope.tenant_id, scope.branch_id, scope.pos_terminal_id,
        scope.operational_terminal_id, scope.terminal_device_id, scope.logical_scale_id],
    );
    if (binding.rowCount !== 1) throw new Error("AUTHORIZED_SCALE_BINDING_REQUIRED");
    const pending = await client.query<CaptureRow>(
      `SELECT * FROM terminal_scale_weight_captures WHERE capture_id = $1 FOR UPDATE`, [input.captureId],
    );
    if (pending.rowCount !== 1) throw new Error("CAPTURE_NOT_FOUND");
    const ready = markCaptureReady(captureDomainValue(pending.rows[0]), input.observation, now);
    if (ready.status !== "READY") throw new Error(ready.status === "EXPIRED" ? "CAPTURE_EXPIRED" : "CAPTURE_OBSERVATION_NOT_COMMERCIAL");
    const result = await client.query<CaptureRow>(
      `UPDATE terminal_scale_weight_captures c
       SET status = 'READY', weight_kg = $2::numeric, measurement_source = 'REAL',
           measurement_unit = 'kg', unit_verified = true, observed_at = $3
       WHERE c.capture_id = $1 AND c.status = 'PENDING' AND c.expires_at > $4
         AND $2::numeric >= 0 AND EXISTS (SELECT 1 FROM terminal_scale_bindings b
           WHERE b.id = c.terminal_scale_binding_id AND b.tenant_id = c.tenant_id
             AND b.branch_id = c.branch_id AND b.pos_terminal_id = c.pos_terminal_id
             AND b.operational_terminal_id = c.operational_terminal_id
             AND b.status = 'AUTHORIZED' AND b.unit_state = 'KG_VERIFIED'
             AND b.terminal_device_id = c.terminal_device_id AND b.logical_scale_id = c.logical_scale_id)
       RETURNING c.capture_id, c.weight_kg, c.status, c.expires_at`,
      [input.captureId, input.observation.value, input.observation.observedAt, now],
    );
    if (result.rowCount !== 1) throw new Error("CAPTURE_NOT_PENDING_OR_BINDING_UNAVAILABLE");
    return result.rows[0];
  }

  async consume(client: Queryable, input: {
    captureId: string; nonce: string; expected: CaptureScope; saleId: string; consumerUserId: string; now?: Date;
  }) {
    const nonceVerifier = verifierFor(input.nonce);
    const now = input.now ?? new Date();
    const binding = await client.query<QueryResultRow>(
      `SELECT id FROM terminal_scale_bindings
       WHERE id = $1 AND tenant_id = $2 AND branch_id = $3 AND pos_terminal_id = $4
         AND operational_terminal_id = $5 AND terminal_device_id = $6 AND logical_scale_id = $7
         AND status = 'AUTHORIZED' AND unit_state = 'KG_VERIFIED'
       FOR SHARE`,
      [input.expected.bindingId, input.expected.tenantId, input.expected.branchId,
        input.expected.posTerminalId, input.expected.operationalTerminalId,
        input.expected.terminalDeviceId, input.expected.logicalScaleId],
    );
    if (binding.rowCount !== 1) throw new Error("AUTHORIZED_SCALE_BINDING_REQUIRED");
    const persisted = await client.query<CaptureRow>(
      `SELECT * FROM terminal_scale_weight_captures WHERE capture_id = $1 AND tenant_id = $2 FOR UPDATE`,
      [input.captureId, input.expected.tenantId],
    );
    if (persisted.rowCount !== 1) throw new Error("CAPTURE_NOT_FOUND");
    const expectedDomainContext: WeightCaptureContext = {
      tenantId: input.expected.tenantId, branchId: input.expected.branchId,
      posTerminalId: input.expected.posTerminalId, operationalTerminalId: input.expected.operationalTerminalId,
      posSessionId: input.expected.posSessionId, productId: input.expected.productId,
      logicalScaleId: input.expected.logicalScaleId, bindingId: input.expected.bindingId,
    };
    consumeWeightCapture(captureDomainValue(persisted.rows[0]), input.nonce, expectedDomainContext, now);
    const result = await client.query<CaptureRow>(
      `UPDATE terminal_scale_weight_captures c
       SET status = 'CONSUMED', consumed_at = $12, consumed_sale_id = $13, consumed_by_user_id = $14
       WHERE c.capture_id = $1 AND c.status = 'READY' AND c.expires_at > $12
         AND c.nonce_verifier_sha256 = $2
         AND c.tenant_id = $3 AND c.branch_id = $4 AND c.pos_terminal_id = $5
         AND c.operational_terminal_id = $6 AND c.pos_session_id = $7 AND c.product_id = $8
         AND c.terminal_device_id = $9 AND c.logical_scale_id = $10 AND c.terminal_scale_binding_id = $11
         AND c.measurement_source = 'REAL' AND c.measurement_unit = 'kg' AND c.unit_verified = true
         AND EXISTS (SELECT 1 FROM terminal_scale_bindings b
           WHERE b.id = c.terminal_scale_binding_id AND b.tenant_id = c.tenant_id
             AND b.branch_id = c.branch_id AND b.pos_terminal_id = c.pos_terminal_id
             AND b.operational_terminal_id = c.operational_terminal_id
             AND b.terminal_device_id = c.terminal_device_id AND b.logical_scale_id = c.logical_scale_id
             AND b.status = 'AUTHORIZED' AND b.unit_state = 'KG_VERIFIED')
         AND EXISTS (SELECT 1 FROM sales s WHERE s.tenant_id = c.tenant_id AND s.id = $13
           AND s.branch_id = c.branch_id AND s.terminal_id = c.operational_terminal_id
           AND s.pos_session_id = c.pos_session_id)
       RETURNING c.capture_id, c.weight_kg, c.status, c.expires_at`,
      [input.captureId, nonceVerifier, input.expected.tenantId, input.expected.branchId,
        input.expected.posTerminalId, input.expected.operationalTerminalId, input.expected.posSessionId,
        input.expected.productId, input.expected.terminalDeviceId, input.expected.logicalScaleId,
        input.expected.bindingId, now,
        input.saleId, input.consumerUserId],
    );
    if (result.rowCount !== 1) throw new Error("CAPTURE_NOT_CONSUMABLE");
    return { captureId: result.rows[0].capture_id, weightKg: Number(result.rows[0].weight_kg) };
  }
}
