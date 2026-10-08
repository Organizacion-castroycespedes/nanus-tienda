import {
  BadRequestException, ConflictException, ForbiddenException, Inject, Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createPublicKey, timingSafeEqual } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../common/db/database.service";
import { AgentCredentialPersistence, ScaleBindingPersistence } from "./persistence/scale-authorization.repositories";
import { issueOpaqueAgentCredential, verifyOpaqueAgentCredential } from "./domain/agent-credential.domain";
import { createAgentCredentialEnvelope, createSignedAgentPairingChallenge, publicKeyFingerprint, verifySignedAgentPairingChallenge, type SignedAgentPairingChallenge } from "./domain/agent-pairing.domain";
import { deriveRealAvailability, type RealAvailabilityInput } from "./domain/real-availability.domain";
import type { ScaleBindingContext } from "./domain/scale-binding.domain";
import { readPairingSigningConfig } from "./pairing-config";

type Actor = { tenantId?: string; userId?: string; roles?: string[] };
type EnrollmentRequest = { installationId: string; nonce: string; enrollmentPublicKeyPem: string };
type ApprovalRequest = { signedChallenge: SignedAgentPairingChallenge; pairingCode: string; posTerminalId: string; logicalScaleId: string; enrollmentPublicKeyPem: string };

@Injectable()
export class ScaleAuthorizationRuntimeService {
  private readonly challengeAttempts = new Map<string, number[]>();
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AgentCredentialPersistence) private readonly credentials: AgentCredentialPersistence,
    @Inject(ScaleBindingPersistence) private readonly bindings: ScaleBindingPersistence,
  ) {}

  private signingConfig() {
    try { return readPairingSigningConfig(); }
    catch { throw new ServiceUnavailableException("AGENT_PAIRING_UNAVAILABLE"); }
  }

  async createPairingChallenge(input: EnrollmentRequest) {
    if (!input || typeof input.installationId !== "string" || !input.installationId.trim()
      || typeof input.nonce !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(input.nonce)
      || typeof input.enrollmentPublicKeyPem !== "string" || input.enrollmentPublicKeyPem.length > 8192) {
      throw new BadRequestException("PAIRING_REQUEST_INVALID");
    }
    const config = this.signingConfig();
    const nowMs = Date.now();
    let fingerprint: string;
    try { fingerprint = publicKeyFingerprint(input.enrollmentPublicKeyPem); }
    catch { throw new BadRequestException("AGENT_ENROLLMENT_KEY_INVALID"); }
    const device = await this.db.query<QueryResultRow & { id: string; tenant_id: string; registration_status: string }>(
      `SELECT id, tenant_id, registration_status FROM terminal_devices WHERE installation_id = $1 LIMIT 1`,
      [input.installationId.trim()],
    );
    if (device.rows.length !== 1 || device.rows[0].registration_status === "REVOKED") {
      throw new ForbiddenException("AGENT_DEVICE_NOT_REGISTERED");
    }
    const recent = (this.challengeAttempts.get(device.rows[0].id) ?? []).filter((time) => nowMs - time < 10 * 60_000);
    if (recent.length >= 5) throw new ConflictException("PAIRING_CHALLENGE_RATE_LIMITED");
    recent.push(nowMs);
    if (this.challengeAttempts.size > 10_000) {
      for (const [id, attempts] of this.challengeAttempts) {
        if (!attempts.some((time) => nowMs - time < 10 * 60_000)) this.challengeAttempts.delete(id);
      }
    }
    this.challengeAttempts.set(device.rows[0].id, recent);
    const signedChallenge = createSignedAgentPairingChallenge({
      ...config, installationId: input.installationId.trim(), terminalDeviceId: device.rows[0].id,
      enrollmentPublicKeyPem: input.enrollmentPublicKeyPem, nonce: input.nonce,
    });
    if (signedChallenge.challenge.enrollmentKeyFingerprint !== fingerprint) {
      throw new BadRequestException("AGENT_ENROLLMENT_KEY_INVALID");
    }
    return signedChallenge;
  }

  async approvePairing(input: ApprovalRequest, actor: Actor) {
    const config = this.signingConfig();
    const signed = input?.signedChallenge;
    if (!actor.tenantId || !actor.userId || !input?.posTerminalId || !input.logicalScaleId
      || !/^[0-9]{10}$/.test(input.pairingCode ?? "")
      || !signed?.challenge || typeof signed.signature !== "string" || signed.keyId !== config.keyId
      || signed.challenge.typ !== "MANUS_AGENT_PAIRING_V1"
      || typeof signed.challenge.jti !== "string" || typeof signed.challenge.installationId !== "string"
      || typeof signed.challenge.terminalDeviceId !== "string" || typeof signed.challenge.nonce !== "string"
      || typeof signed.challenge.pairingCode !== "string" || typeof signed.challenge.audience !== "string"
      || typeof signed.challenge.enrollmentKeyFingerprint !== "string"
      || typeof signed.challenge.issuedAt !== "string" || typeof signed.challenge.expiresAt !== "string") {
      throw new BadRequestException("PAIRING_APPROVAL_INVALID");
    }
    const challenge = signed.challenge;
    const client = await this.db.getClient();
    let secret: string | undefined;
    try {
      await client.query("BEGIN");
      const device = await client.query<QueryResultRow & { id: string; tenant_id: string; installation_id: string; registration_status: string }>(
        `SELECT id, tenant_id, installation_id, registration_status FROM terminal_devices
         WHERE id = $1 AND tenant_id = $2 FOR UPDATE`, [challenge.terminalDeviceId, actor.tenantId],
      );
      if (device.rowCount !== 1 || device.rows[0].registration_status === "REVOKED"
        || device.rows[0].installation_id !== challenge.installationId) throw new ForbiddenException("PAIRING_DEVICE_SCOPE_MISMATCH");
      const pos = await client.query<QueryResultRow & { id: string; branch_id: string; operational_terminal_id: string | null }>(
        `SELECT id, branch_id, operational_terminal_id FROM pos_terminals
         WHERE id = $1 AND tenant_id = $2 AND active = true FOR SHARE`, [input.posTerminalId, actor.tenantId],
      );
      if (pos.rowCount !== 1 || !pos.rows[0].operational_terminal_id) throw new ForbiddenException("PAIRING_TERMINAL_SCOPE_MISMATCH");
      const operational = await client.query<QueryResultRow>(
        `SELECT id FROM terminals WHERE id=$1 AND tenant_id=$2 AND branch_id=$3 AND is_active=true FOR SHARE`,
        [pos.rows[0].operational_terminal_id, actor.tenantId, pos.rows[0].branch_id],
      );
      if (operational.rowCount !== 1) throw new ForbiddenException("PAIRING_TERMINAL_SCOPE_MISMATCH");
      const terminal = await client.query<QueryResultRow>(
        `SELECT 1 FROM terminal_device_bindings WHERE tenant_id = $1 AND terminal_id = $2
           AND device_id = $3 AND status = 'ACTIVE' FOR SHARE`,
        [actor.tenantId, pos.rows[0].operational_terminal_id, challenge.terminalDeviceId],
      );
      if (terminal.rowCount !== 1) throw new ForbiddenException("PAIRING_OPERATIONAL_DEVICE_NOT_BOUND");
      let verified = false;
      try {
        verified = verifySignedAgentPairingChallenge({
          signed, publicKeyPem: createPublicKey(config.privateKeyPem).export({ type: "spki", format: "pem" }).toString(), expectedAudience: config.audience,
          expectedInstallationId: device.rows[0].installation_id,
          expectedTerminalDeviceId: challenge.terminalDeviceId,
          expectedEnrollmentKeyFingerprint: publicKeyFingerprint(input.enrollmentPublicKeyPem),
        });
      } catch { verified = false; }
      const suppliedCode = Buffer.from(input.pairingCode, "utf8");
      const challengeCode = Buffer.from(challenge.pairingCode, "utf8");
      const pairingCodeMatches = suppliedCode.length === challengeCode.length && timingSafeEqual(suppliedCode, challengeCode);
      if (!verified || !pairingCodeMatches) throw new ForbiddenException("PAIRING_CHALLENGE_INVALID");
      const existing = await client.query<QueryResultRow>(
        `SELECT id FROM terminal_device_credentials WHERE tenant_id = $1 AND terminal_device_id = $2
          AND status = 'ACTIVE' AND expires_at > now() FOR UPDATE`, [actor.tenantId, challenge.terminalDeviceId],
      );
      if (existing.rowCount) throw new ConflictException("ACTIVE_AGENT_CREDENTIAL_EXISTS");
      const issued = issueOpaqueAgentCredential();
      secret = issued.secret;
      const credentialExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60_000);
      const row = await this.credentials.issue(client, {
        tenantId: actor.tenantId, terminalDeviceId: challenge.terminalDeviceId,
        credentialId: challenge.jti, secret, expiresAt: credentialExpiresAt, actorId: actor.userId,
      });
      if (!row) throw new ForbiddenException("PAIRING_DEVICE_SCOPE_MISMATCH");
      const envelope = createAgentCredentialEnvelope({
        keyId: config.keyId, privateKeyPem: config.privateKeyPem, challenge,
        enrollmentPublicKeyPem: input.enrollmentPublicKeyPem, credentialSecret: secret,
        credentialExpiresAt: credentialExpiresAt.toISOString(),
      });
      await client.query("COMMIT");
      return { envelope, credentialId: challenge.jti, expiresAt: credentialExpiresAt.toISOString() };
    } catch (error) {
      await client.query("ROLLBACK");
      if ((error as { code?: string })?.code === "23505") throw new ConflictException("PAIRING_CHALLENGE_ALREADY_USED");
      throw error;
    } finally {
      secret = undefined;
      client.release();
    }
  }

  async authenticateAgent(authorization: string | undefined) {
    const match = /^Agent ([0-9a-f-]{36})\.([A-Za-z0-9_-]{32,128})$/.exec(authorization ?? "");
    if (!match) throw new ForbiddenException("AGENT_CREDENTIAL_INVALID");
    const client = await this.db.getClient();
    try {
      const result = await client.query<QueryResultRow & { id: string; tenant_id: string; terminal_device_id: string; verifier_sha256: string; expires_at: Date; revoked_at: Date | null }>(
        `SELECT c.id, c.tenant_id, c.terminal_device_id, c.verifier_sha256, c.expires_at, c.revoked_at
         FROM terminal_device_credentials c JOIN terminal_devices d
           ON d.id = c.terminal_device_id AND d.tenant_id = c.tenant_id
         WHERE c.credential_id = $1 AND c.status = 'ACTIVE' AND c.expires_at > now()
           AND d.registration_status <> 'REVOKED' LIMIT 1`, [match[1]],
      );
      const row = result.rows[0];
      if (!row || verifyOpaqueAgentCredential(match[2], { verifierSha256: row.verifier_sha256,
        expiresAt: row.expires_at.toISOString(), revokedAt: row.revoked_at?.toISOString() }) !== "VALID") {
        throw new ForbiddenException("AGENT_CREDENTIAL_INVALID");
      }
      return { tenantId: row.tenant_id, terminalDeviceId: row.terminal_device_id,
        credentialId: match[1], credentialSecret: match[2] };
    } finally { client.release(); }
  }

  async createBinding(input: { posTerminalId: string; logicalScaleId: string }, actor: Actor) {
    if (!actor.tenantId || !actor.userId || !input?.logicalScaleId) throw new BadRequestException("SCALE_BINDING_INPUT_INVALID");
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const result = await client.query<QueryResultRow & { tenant_id: string; branch_id: string; operational_terminal_id: string; terminal_device_id: string }>(
        `SELECT p.tenant_id, p.branch_id, p.operational_terminal_id, d.device_id AS terminal_device_id
         FROM pos_terminals p JOIN terminal_device_bindings d
           ON d.tenant_id = p.tenant_id AND d.terminal_id = p.operational_terminal_id AND d.status = 'ACTIVE'
         JOIN terminal_devices td ON td.id = d.device_id AND td.tenant_id = d.tenant_id AND td.registration_status <> 'REVOKED'
         JOIN terminal_device_credentials c ON c.tenant_id = td.tenant_id AND c.terminal_device_id = td.id
           AND c.status = 'ACTIVE' AND c.expires_at > now()
         JOIN pos_terminal_peripheral_settings ps ON ps.terminal_id = p.id
           AND ps.scale_device_id = $2::text AND ps.enable_scale = true
         WHERE p.id = $1 AND p.tenant_id = $3 AND p.active = true AND p.operational_terminal_id IS NOT NULL
         FOR SHARE OF p, d, td`, [input.posTerminalId, input.logicalScaleId, actor.tenantId],
      );
      if (result.rowCount !== 1) throw new ForbiddenException("SCALE_AGENT_TERMINAL_SCOPE_UNAVAILABLE");
      const row = result.rows[0];
      const existing = await client.query<QueryResultRow & { id: string; terminal_device_id: string; logical_scale_id: string; status: string }>(
        `SELECT id, terminal_device_id, logical_scale_id, status FROM terminal_scale_bindings
         WHERE tenant_id = $1 AND pos_terminal_id = $2 AND status IN ('PENDING','AUTHORIZED')
         FOR UPDATE`, [row.tenant_id, input.posTerminalId],
      );
      const sameBinding = existing.rows.find((binding) => binding.terminal_device_id === row.terminal_device_id
        && binding.logical_scale_id === input.logicalScaleId);
      if (sameBinding) {
        await client.query("COMMIT");
        return sameBinding;
      }
      for (const binding of existing.rows) {
        const revoked = await this.bindings.revoke(client, row.tenant_id, binding.id, actor.userId);
        if (!revoked) throw new ConflictException("SCALE_REBIND_REQUIRED");
      }
      const created = await this.bindings.createPending(client, {
        tenantId: row.tenant_id, branchId: row.branch_id, posTerminalId: input.posTerminalId,
        operationalTerminalId: row.operational_terminal_id, terminalDeviceId: row.terminal_device_id,
        logicalScaleId: input.logicalScaleId,
      }, actor.userId);
      if (!created) throw new ForbiddenException("SCALE_BINDING_CONTEXT_INVALID");
      await client.query("COMMIT");
      return created;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async confirmKg(tenantId: string | undefined, userId: string | undefined, bindingId: string) {
    if (!tenantId || !userId) throw new ForbiddenException("OPERATOR_CONTEXT_REQUIRED");
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const current = await client.query<QueryResultRow & ScaleBindingContext>(
        `SELECT b.tenant_id AS "tenantId", b.branch_id AS "branchId", b.pos_terminal_id AS "posTerminalId",
          b.operational_terminal_id AS "operationalTerminalId", b.terminal_device_id AS "terminalDeviceId", b.logical_scale_id AS "logicalScaleId"
         FROM terminal_scale_bindings b
         JOIN pos_terminals p ON p.id=b.pos_terminal_id AND p.tenant_id=b.tenant_id
           AND p.branch_id=b.branch_id AND p.operational_terminal_id=b.operational_terminal_id AND p.active=true
         JOIN terminals t ON t.id=b.operational_terminal_id AND t.tenant_id=b.tenant_id
           AND t.branch_id=b.branch_id AND t.is_active=true
         JOIN terminal_device_bindings d ON d.tenant_id=b.tenant_id AND d.terminal_id=b.operational_terminal_id
           AND d.device_id=b.terminal_device_id AND d.status='ACTIVE'
         JOIN terminal_devices td ON td.id=b.terminal_device_id AND td.tenant_id=b.tenant_id
           AND td.registration_status <> 'REVOKED'
         JOIN terminal_device_credentials c ON c.tenant_id=b.tenant_id AND c.terminal_device_id=b.terminal_device_id
           AND c.status='ACTIVE' AND c.expires_at > now()
         JOIN pos_terminal_peripheral_settings ps ON ps.terminal_id=b.pos_terminal_id
           AND ps.enable_scale=true AND ps.scale_device_id=b.logical_scale_id
         WHERE b.id = $1 AND b.tenant_id = $2 AND b.status='PENDING' AND b.unit_state='NOT_VERIFIED'
         FOR UPDATE OF b`, [bindingId, tenantId],
      );
      if (!current.rows[0]) throw new ForbiddenException("SCALE_BINDING_NOT_FOUND");
      const confirmedAt = new Date().toISOString();
      const updated = await this.bindings.authorize(client, {
        tenantId, bindingId, expectedContext: current.rows[0], confirmation: {
          method: "OPERATOR_CONFIRMATION", displayedUnit: "kg", operatorId: userId, confirmedAt,
        },
      });
      await client.query("COMMIT");
      return { ...updated, unitVerification: {
        method: "OPERATOR_CONFIRMATION" as const, unit: "kg" as const, operatorId: userId, verifiedAt: confirmedAt,
      } };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async getTerminalState(posTerminalId: string, actor: Actor) {
    if (!actor.tenantId || !posTerminalId) throw new BadRequestException("POS_TERMINAL_REQUIRED");
    const result = await this.db.query<QueryResultRow & {
      pos_terminal_id: string; branch_id: string; operational_terminal_id: string | null;
      scale_device_id: string | null; enable_scale: boolean;
      device_id: string | null; registration_status: string | null; installation_id: string | null;
      credential_id: string | null; credential_status: string | null; credential_expires_at: Date | null;
      binding_id: string | null; logical_scale_id: string | null; binding_status: string | null;
      unit_state: string | null; unit_verification_method: string | null; unit_verification_unit: string | null;
      unit_verified_by_user_id: string | null; verified_at: Date | null;
    }>(
      `SELECT p.id AS pos_terminal_id, p.branch_id, p.operational_terminal_id,
         ps.scale_device_id, COALESCE(ps.enable_scale, false) AS enable_scale,
         d.id AS device_id, d.registration_status, d.installation_id,
         c.status AS credential_status, c.expires_at AS credential_expires_at,
         b.id AS binding_id, b.logical_scale_id, b.status AS binding_status, b.unit_state,
         b.unit_verification_method, b.unit_verification_unit, b.unit_verified_by_user_id, b.verified_at
       FROM pos_terminals p
       LEFT JOIN pos_terminal_peripheral_settings ps ON ps.terminal_id = p.id
       LEFT JOIN terminal_device_bindings td_b ON td_b.tenant_id = p.tenant_id
         AND td_b.terminal_id = p.operational_terminal_id AND td_b.status = 'ACTIVE'
       LEFT JOIN terminal_devices d ON d.id = td_b.device_id AND d.tenant_id = p.tenant_id
       LEFT JOIN LATERAL (
         SELECT credential_id, status, expires_at FROM terminal_device_credentials
         WHERE tenant_id = p.tenant_id AND terminal_device_id = d.id
         ORDER BY issued_at DESC LIMIT 1
       ) c ON true
       LEFT JOIN LATERAL (
         SELECT id, logical_scale_id, status, unit_state, unit_verification_method,
           unit_verification_unit, unit_verified_by_user_id, verified_at
         FROM terminal_scale_bindings WHERE tenant_id=p.tenant_id AND pos_terminal_id=p.id
         ORDER BY created_at DESC LIMIT 1
       ) b ON true
       WHERE p.id = $1 AND p.tenant_id = $2 AND p.active = true LIMIT 1`, [posTerminalId, actor.tenantId],
    );
    const row = result.rows[0];
    if (!row) throw new ForbiddenException("POS_TERMINAL_SCOPE_INVALID");
    const credentialActive = row.credential_status === "ACTIVE" && row.credential_expires_at !== null
      && row.credential_expires_at.getTime() > Date.now();
    const identityMatches = !row.binding_id || row.logical_scale_id === row.scale_device_id;
    return {
      posTerminalId: row.pos_terminal_id,
      branchId: row.branch_id,
      operationalTerminalId: row.operational_terminal_id,
      scaleDeviceId: row.scale_device_id,
      enableScale: row.enable_scale,
      agent: { deviceId: row.device_id, installationId: row.installation_id, credentialId: row.credential_id,
        status: row.registration_status, authenticated: credentialActive },
      binding: row.binding_id ? { id: row.binding_id, logicalScaleId: row.logical_scale_id,
        status: row.binding_status, unitState: row.unit_state,
        verificationMethod: row.unit_verification_method, unit: row.unit_verification_unit,
        verifiedBy: row.unit_verified_by_user_id, verifiedAt: row.verified_at } : null,
      realAvailable: false,
      realAvailabilityReason: !identityMatches ? "SCALE_MISMATCH"
        : credentialActive && row.binding_status === "AUTHORIZED" && row.unit_state === "KG_VERIFIED"
          ? "FRESH_REAL_OBSERVATION_REQUIRED" : "AGENT_BINDING_NOT_READY",
    };
  }

  async revokeBinding(tenantId: string | undefined, bindingId: string, actorId: string | undefined) {
    if (!tenantId || !actorId) throw new ForbiddenException("OPERATOR_CONTEXT_REQUIRED");
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const row = await this.bindings.revoke(client, tenantId, bindingId, actorId);
      if (!row) throw new ConflictException("SCALE_BINDING_NOT_ACTIVE");
      await client.query("COMMIT");
      return row;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async revokeAgentCredential(tenantId: string | undefined, credentialId: string, actorId: string | undefined) {
    if (!tenantId || !actorId || !credentialId) throw new ForbiddenException("OPERATOR_CONTEXT_REQUIRED");
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const revoked = await this.credentials.revoke(client, tenantId, credentialId, actorId);
      if (!revoked) throw new ConflictException("ACTIVE_CREDENTIAL_NOT_FOUND");
      await client.query("COMMIT");
      return revoked;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async deriveReadiness(auth: { tenantId: string; terminalDeviceId: string; credentialId: string }, input: {
    posTerminalId: string; logicalScaleId: string; source: string; unit: string | null; unitVerified: boolean; observedAt: string; credentialSecret: string;
  }) {
    const client = await this.db.getClient();
    try {
      const credential = await client.query<QueryResultRow & { verifier_sha256: string; expires_at: Date; revoked_at: Date | null }>(
        `SELECT verifier_sha256, expires_at, revoked_at FROM terminal_device_credentials
         WHERE tenant_id = $1 AND terminal_device_id = $2 AND credential_id = $3
           AND status = 'ACTIVE' AND expires_at > now()
         LIMIT 1`, [auth.tenantId, auth.terminalDeviceId, auth.credentialId],
      );
      const binding = await client.query<QueryResultRow & { id: string; tenant_id: string; branch_id: string; pos_terminal_id: string;
        operational_terminal_id: string; terminal_device_id: string; logical_scale_id: string; status: string; unit_state: string;
        unit_verification_method: string | null; unit_verification_unit: string | null; unit_verified_by_user_id: string | null; verified_at: Date | null }>(
        `SELECT b.* FROM terminal_scale_bindings b JOIN pos_terminals p ON p.id=b.pos_terminal_id AND p.tenant_id=b.tenant_id
         JOIN terminal_device_bindings d ON d.device_id=b.terminal_device_id AND d.tenant_id=b.tenant_id
           AND d.terminal_id=b.operational_terminal_id AND d.status='ACTIVE'
         JOIN pos_terminal_peripheral_settings ps ON ps.terminal_id=b.pos_terminal_id
           AND ps.enable_scale=true AND ps.scale_device_id=b.logical_scale_id
         WHERE b.tenant_id=$1 AND b.terminal_device_id=$2 AND b.pos_terminal_id=$3
           AND b.logical_scale_id=$4 ORDER BY b.created_at DESC LIMIT 1`,
        [auth.tenantId, auth.terminalDeviceId, input.posTerminalId, input.logicalScaleId],
      );
      const row = binding.rows[0];
      const domainBinding = row ? {
        id: row.id, tenantId: row.tenant_id, branchId: row.branch_id, posTerminalId: row.pos_terminal_id,
        operationalTerminalId: row.operational_terminal_id, terminalDeviceId: row.terminal_device_id,
        logicalScaleId: row.logical_scale_id, status: row.status as "PENDING" | "AUTHORIZED" | "REVOKED" | "DISABLED",
        unitState: row.unit_state as "NOT_VERIFIED" | "KG_VERIFIED",
        ...(row.unit_state === "KG_VERIFIED" && row.unit_verified_by_user_id && row.verified_at ? { unitVerification: {
          method: "OPERATOR_CONFIRMATION" as const, unit: "kg" as const, operatorId: row.unit_verified_by_user_id,
          verifiedAt: row.verified_at.toISOString(),
        } } : {}),
      } : null;
      const current = new Date();
      const goodObservation = input.source === "REAL" && input.unit === "kg" && input.unitVerified
        && Number.isFinite(Date.parse(input.observedAt)) && Date.parse(input.observedAt) <= current.getTime();
      const result = deriveRealAvailability({
        credential: credential.rows[0] ? { verifierSha256: credential.rows[0].verifier_sha256,
          expiresAt: credential.rows[0].expires_at.toISOString(), revokedAt: credential.rows[0].revoked_at?.toISOString() } : null,
        credentialSecret: input.credentialSecret,
        binding: domainBinding,
        expectedContext: domainBinding ?? { tenantId: auth.tenantId, branchId: "", posTerminalId: input.posTerminalId,
          operationalTerminalId: "", terminalDeviceId: auth.terminalDeviceId, logicalScaleId: input.logicalScaleId },
        observation: { available: goodObservation, observedAt: input.observedAt, logicalScaleId: input.logicalScaleId },
        maxObservationAgeMs: 15_000, now: current,
      } satisfies RealAvailabilityInput);
      // Authenticated possession was established on this request; readiness must not accept a browser-supplied secret.
      return { available: result.available && Boolean(credential.rows[0]) && Boolean(domainBinding)
        && domainBinding?.status === "AUTHORIZED" && domainBinding.logicalScaleId === input.logicalScaleId,
        reason: goodObservation ? result.reason : "AGENT_UNAVAILABLE_OR_STALE" };
    } finally { client.release(); }
  }
}
