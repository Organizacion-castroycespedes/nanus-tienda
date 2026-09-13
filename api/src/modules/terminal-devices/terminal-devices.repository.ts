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

export type TerminalRuntimeResolutionRecord = {
  registration_status: TerminalDeviceRecord["registration_status"];
  binding_terminal_id: string | null;
  terminal_id: string | null;
  branch_id: string | null;
  terminal_is_active: boolean | null;
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

  async findRuntimeResolution(installationId: string, tenantId: string) {
    const result = await this.query<TerminalRuntimeResolutionRecord>(
      `SELECT
        device.registration_status,
        binding.terminal_id AS binding_terminal_id,
        terminal.id AS terminal_id,
        terminal.branch_id,
        terminal.is_active AS terminal_is_active
       FROM terminal_devices AS device
       LEFT JOIN terminal_device_bindings AS binding
         ON binding.device_id = device.id
        AND binding.tenant_id = device.tenant_id
        AND binding.status = 'ACTIVE'
       LEFT JOIN terminals AS terminal
         ON terminal.id = binding.terminal_id
        AND terminal.tenant_id = binding.tenant_id
       WHERE device.installation_id = $1
         AND device.tenant_id = $2
       LIMIT 1`,
      [installationId, tenantId],
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
}
