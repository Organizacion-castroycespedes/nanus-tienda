import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../common/db/database.service";

export type TerminalDeviceRecord = {
  id: string;
  tenant_id: string;
  installation_id: string;
  platform: string | null;
  runtime_version: string | null;
  agent_api_version: number | null;
  registration_status: "REGISTERED" | "BOUND" | "UNBOUND" | "REVOKED";
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TerminalDeviceBindingRecord = {
  id: string;
  tenant_id: string;
  terminal_id: string;
  device_id: string;
  status: "ACTIVE" | "UNBOUND" | "REVOKED";
  bound_at: string;
  unbound_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TerminalDeviceCredentialRecord = {
  id: string;
  tenant_id: string;
  terminal_device_id: string;
  credential_id: string;
  verifier_version: string;
  status: "ACTIVE" | "EXPIRED" | "ROTATED" | "REVOKED";
  issued_at: string;
  expires_at: string | null;
  rotated_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  revoked_by: string | null;
};

export type TerminalScaleBindingRecord = {
  id: string;
  tenant_id: string;
  branch_id: string;
  pos_terminal_id: string;
  operational_terminal_id: string;
  terminal_device_id: string;
  logical_scale_id: string;
  status: "PENDING" | "AUTHORIZED" | "REVOKED" | "DISABLED";
  unit_state: "NOT_VERIFIED" | "KG_VERIFIED";
  verified_at: string | null;
  last_observed_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  revoked_by: string | null;
};

@Injectable()
export class TerminalDevicesRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  private query<T extends QueryResultRow>(text: string, params: unknown[] = [], client?: PoolClient) {
    return client ? client.query<T>(text, params) : this.db.query<T>(text, params);
  }

  async findByInstallation(installationId: string, client?: PoolClient) {
    const result = await this.query<TerminalDeviceRecord>(
      `SELECT id, tenant_id, installation_id, platform, runtime_version,
        agent_api_version, registration_status, last_seen_at, created_at, updated_at
       FROM terminal_devices WHERE installation_id = $1 FOR UPDATE`,
      [installationId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async findById(deviceId: string, client?: PoolClient) {
    const result = await this.query<TerminalDeviceRecord>(
      `SELECT id, tenant_id, installation_id, platform, runtime_version,
        agent_api_version, registration_status, last_seen_at, created_at, updated_at
       FROM terminal_devices WHERE id = $1`,
      [deviceId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async listByTenant(tenantId: string) {
    const result = await this.query<TerminalDeviceRecord>(
      `SELECT id, tenant_id, installation_id, platform, runtime_version,
        agent_api_version, registration_status, last_seen_at, created_at, updated_at
       FROM terminal_devices WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows;
  }

  async register(client: PoolClient, data: {
    tenantId: string;
    installationId: string;
    platform?: string | null;
    runtimeVersion?: string | null;
    agentApiVersion?: number | null;
  }) {
    const result = await this.query<TerminalDeviceRecord>(
      `INSERT INTO terminal_devices
        (tenant_id, installation_id, platform, runtime_version, agent_api_version,
         registration_status, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, 'REGISTERED', now())
       RETURNING id, tenant_id, installation_id, platform, runtime_version,
         agent_api_version, registration_status, last_seen_at, created_at, updated_at`,
      [data.tenantId, data.installationId, data.platform ?? null, data.runtimeVersion ?? null, data.agentApiVersion ?? null],
      client,
    );
    return result.rows[0] ?? null;
  }

  async touch(client: PoolClient, deviceId: string, data: { platform?: string | null; runtimeVersion?: string | null; agentApiVersion?: number | null }) {
    const result = await this.query<TerminalDeviceRecord>(
      `UPDATE terminal_devices SET platform = COALESCE($2, platform), runtime_version = COALESCE($3, runtime_version), agent_api_version = COALESCE($4, agent_api_version), last_seen_at = now() WHERE id = $1 RETURNING id, tenant_id, installation_id, platform, runtime_version, agent_api_version, registration_status, last_seen_at, created_at, updated_at`,
      [deviceId, data.platform ?? null, data.runtimeVersion ?? null, data.agentApiVersion ?? null], client,
    );
    return result.rows[0] ?? null;
  }

  async findTerminal(terminalId: string, client?: PoolClient) {
    const result = await this.query<{ id: string; tenant_id: string; is_active: boolean }>(
      `SELECT id, tenant_id, is_active FROM terminals WHERE id = $1`,
      [terminalId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async findActiveByTerminal(terminalId: string, client?: PoolClient) {
    const result = await this.query<TerminalDeviceBindingRecord>(
      `SELECT * FROM terminal_device_bindings WHERE terminal_id = $1 AND status = 'ACTIVE' FOR UPDATE`,
      [terminalId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async findActiveByDevice(deviceId: string, client?: PoolClient) {
    const result = await this.query<TerminalDeviceBindingRecord>(
      `SELECT * FROM terminal_device_bindings WHERE device_id = $1 AND status = 'ACTIVE' FOR UPDATE`,
      [deviceId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async listBindings(tenantId: string, terminalId?: string, deviceId?: string) {
    const params: unknown[] = [tenantId];
    const where = ["tenant_id = $1"];
    if (terminalId) { params.push(terminalId); where.push(`terminal_id = $${params.length}`); }
    if (deviceId) { params.push(deviceId); where.push(`device_id = $${params.length}`); }
    const result = await this.query<TerminalDeviceBindingRecord>(
      `SELECT * FROM terminal_device_bindings WHERE ${where.join(" AND ")} ORDER BY created_at DESC`,
      params,
    );
    return result.rows;
  }

  async createBinding(client: PoolClient, tenantId: string, terminalId: string, deviceId: string) {
    const result = await this.query<TerminalDeviceBindingRecord>(
      `INSERT INTO terminal_device_bindings (tenant_id, terminal_id, device_id, status)
       VALUES ($1, $2, $3, 'ACTIVE') RETURNING *`,
      [tenantId, terminalId, deviceId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async updateBinding(client: PoolClient, bindingId: string, status: "UNBOUND" | "REVOKED") {
    const column = status === "UNBOUND" ? "unbound_at" : "revoked_at";
    const result = await this.query<TerminalDeviceBindingRecord>(
      `UPDATE terminal_device_bindings SET status = $2, ${column} = now() WHERE id = $1 RETURNING *`,
      [bindingId, status],
      client,
    );
    return result.rows[0] ?? null;
  }

  async updateDeviceStatus(client: PoolClient, deviceId: string, status: TerminalDeviceRecord["registration_status"]) {
    const result = await this.query<TerminalDeviceRecord>(
      `UPDATE terminal_devices SET registration_status = $2, updated_at = now()
       WHERE id = $1 RETURNING id, tenant_id, installation_id, platform, runtime_version,
         agent_api_version, registration_status, last_seen_at, created_at, updated_at`,
      [deviceId, status],
      client,
    );
    return result.rows[0] ?? null;
  }

  async createCredential(client: PoolClient, data: { tenantId: string; deviceId: string; credentialId: string; verifierSha256: string; expiresAt?: string | null; actorId?: string | null }) {
    const result = await this.query<TerminalDeviceCredentialRecord>(
      `INSERT INTO terminal_device_credentials
        (tenant_id, terminal_device_id, credential_id, verifier_sha256, expires_at, created_by)
       SELECT $1, id, $3, $4, $5, $6 FROM terminal_devices
       WHERE id = $2 AND tenant_id = $1 AND registration_status <> 'REVOKED'
       RETURNING id, tenant_id, terminal_device_id, credential_id, verifier_version,
         status, issued_at, expires_at, rotated_at, revoked_at, created_by, revoked_by`,
      [data.tenantId, data.deviceId, data.credentialId, data.verifierSha256, data.expiresAt ?? null, data.actorId ?? null],
      client,
    );
    return result.rows[0] ?? null;
  }

  async listCredentials(tenantId: string, deviceId?: string) {
    const params: unknown[] = [tenantId];
    const where = ["tenant_id = $1"];
    if (deviceId) { params.push(deviceId); where.push(`terminal_device_id = $${params.length}`); }
    const result = await this.query<TerminalDeviceCredentialRecord>(
      `SELECT id, tenant_id, terminal_device_id, credential_id, verifier_version, status,
        issued_at, expires_at, rotated_at, revoked_at, created_by, revoked_by
       FROM terminal_device_credentials WHERE ${where.join(" AND ")} ORDER BY issued_at DESC`, params);
    return result.rows;
  }

  async revokeCredential(client: PoolClient, tenantId: string, credentialId: string, actorId?: string | null) {
    const result = await this.query<TerminalDeviceCredentialRecord>(
      `UPDATE terminal_device_credentials
       SET status = 'REVOKED', revoked_at = now(), revoked_by = $3, updated_at = now()
       WHERE tenant_id = $1 AND credential_id = $2 AND status <> 'REVOKED'
       RETURNING id, tenant_id, terminal_device_id, credential_id, verifier_version, status,
         issued_at, expires_at, rotated_at, revoked_at, created_by, revoked_by`,
      [tenantId, credentialId, actorId ?? null], client);
    return result.rows[0] ?? null;
  }

  async createScaleBinding(client: PoolClient, data: { tenantId: string; branchId: string; posTerminalId: string; operationalTerminalId: string; deviceId: string; logicalScaleId: string; actorId?: string | null }) {
    const result = await this.query<TerminalScaleBindingRecord>(
      `INSERT INTO terminal_scale_bindings
        (tenant_id, branch_id, pos_terminal_id, operational_terminal_id, terminal_device_id, logical_scale_id, created_by)
       SELECT $1, p.branch_id, p.id, t.id, d.id, $6, $7
       FROM pos_terminals p
       JOIN terminals t ON t.id = $4 AND t.tenant_id = p.tenant_id AND t.branch_id = p.branch_id AND t.is_active = true
       JOIN terminal_devices d ON d.id = $5 AND d.tenant_id = p.tenant_id AND d.registration_status <> 'REVOKED'
       JOIN terminal_device_bindings b ON b.tenant_id = p.tenant_id AND b.terminal_id = t.id AND b.device_id = d.id AND b.status = 'ACTIVE'
       WHERE p.id = $3 AND p.tenant_id = $1 AND p.branch_id = $2 AND p.active = true
       RETURNING *`,
      [data.tenantId, data.branchId, data.posTerminalId, data.operationalTerminalId, data.deviceId, data.logicalScaleId, data.actorId ?? null], client);
    return result.rows[0] ?? null;
  }

  async listScaleBindings(tenantId: string, terminalId?: string) {
    const params: unknown[] = [tenantId];
    const where = ["tenant_id = $1"];
    if (terminalId) { params.push(terminalId); where.push(`pos_terminal_id = $${params.length}`); }
    const result = await this.query<TerminalScaleBindingRecord>(`SELECT * FROM terminal_scale_bindings WHERE ${where.join(" AND ")} ORDER BY created_at DESC`, params);
    return result.rows;
  }

  async revokeScaleBinding(client: PoolClient, tenantId: string, bindingId: string, actorId?: string | null) {
    const result = await this.query<TerminalScaleBindingRecord>(
      `UPDATE terminal_scale_bindings SET status = 'REVOKED', revoked_at = now(), revoked_by = $3, updated_at = now()
       WHERE tenant_id = $1 AND id = $2 AND status <> 'REVOKED' RETURNING *`,
      [tenantId, bindingId, actorId ?? null], client);
    return result.rows[0] ?? null;
  }
}
