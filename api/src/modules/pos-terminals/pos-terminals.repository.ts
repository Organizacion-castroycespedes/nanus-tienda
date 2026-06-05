import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../common/db/database.service";

export type PosTerminalMode = "MOCK" | "REAL" | "HYBRID";

export type PosTerminalRecord = {
  id: string;
  tenant_id: string;
  branch_id: string;
  branch_name: string | null;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  mode: PosTerminalMode;
  created_at: string;
  updated_at: string;
};

export type PosTerminalPeripheralSettingsRecord = {
  id: string;
  terminal_id: string;
  printer_device_id: string | null;
  cash_drawer_device_id: string | null;
  scale_device_id: string | null;
  scanner_device_id: string | null;
  enable_print_sale: boolean;
  enable_print_purchase: boolean;
  enable_print_order: boolean;
  enable_open_drawer: boolean;
  enable_scale: boolean;
  enable_scanner: boolean;
  created_at: string;
  updated_at: string;
};

export type BranchRecord = {
  id: string;
  tenant_id: string;
  nombre: string;
};

export type CreatePosTerminalInput = {
  tenantId: string;
  branchId: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  mode: PosTerminalMode;
};

export type UpdatePosTerminalInput = Partial<
  Pick<CreatePosTerminalInput, "branchId" | "code" | "name" | "description" | "active" | "mode">
>;

export type UpsertPeripheralSettingsInput = {
  printerDeviceId: string | null;
  cashDrawerDeviceId: string | null;
  scaleDeviceId: string | null;
  scannerDeviceId: string | null;
  enablePrintSale: boolean;
  enablePrintPurchase: boolean;
  enablePrintOrder: boolean;
  enableOpenDrawer: boolean;
  enableScale: boolean;
  enableScanner: boolean;
};

@Injectable()
export class PosTerminalsRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  private async query<T extends QueryResultRow>(
    text: string,
    params: unknown[] = [],
    client?: PoolClient
  ) {
    if (client) {
      return client.query<T>(text, params);
    }
    return this.db.query<T>(text, params);
  }

  private selectTerminalSql() {
    return `
      SELECT
        terminal.id,
        terminal.tenant_id,
        terminal.branch_id,
        branch.nombre AS branch_name,
        terminal.code,
        terminal.name,
        terminal.description,
        terminal.active,
        terminal.mode,
        terminal.created_at,
        terminal.updated_at
      FROM public.pos_terminals AS terminal
      LEFT JOIN public.tenant_branches AS branch
        ON branch.id = terminal.branch_id
       AND branch.tenant_id = terminal.tenant_id
    `;
  }

  async validateBranch(tenantId: string, branchId: string): Promise<boolean> {
    const result = await this.query<QueryResultRow>(
      `SELECT 1
      FROM public.tenant_branches
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1`,
      [tenantId, branchId]
    );
    return result.rows.length > 0;
  }

  async findPrincipalBranch(tenantId: string): Promise<BranchRecord | null> {
    const result = await this.query<BranchRecord>(
      `SELECT id, tenant_id, nombre
      FROM public.tenant_branches
      WHERE tenant_id = $1
      ORDER BY es_principal DESC, created_at ASC
      LIMIT 1`,
      [tenantId]
    );
    return result.rows[0] ?? null;
  }

  async existsCodeInBranch(
    tenantId: string,
    branchId: string,
    code: string,
    excludeId?: string
  ) {
    const params: unknown[] = [tenantId, branchId, code.toLowerCase()];
    let excludeClause = "";
    if (excludeId) {
      params.push(excludeId);
      excludeClause = ` AND id <> $${params.length}`;
    }

    const result = await this.query<QueryResultRow>(
      `SELECT 1
      FROM public.pos_terminals
      WHERE tenant_id = $1
        AND branch_id = $2
        AND lower(code) = $3
        ${excludeClause}
      LIMIT 1`,
      params
    );
    return result.rows.length > 0;
  }

  async findAll(tenantId: string, branchId?: string) {
    const params: unknown[] = [tenantId];
    let branchClause = "";
    if (branchId) {
      params.push(branchId);
      branchClause = ` AND terminal.branch_id = $${params.length}`;
    }

    const result = await this.query<PosTerminalRecord>(
      `${this.selectTerminalSql()}
      WHERE terminal.tenant_id = $1
        ${branchClause}
      ORDER BY terminal.active DESC, terminal.created_at DESC`,
      params
    );
    return result.rows;
  }

  async findById(id: string, tenantId?: string) {
    const params: unknown[] = [id];
    let tenantClause = "";
    if (tenantId) {
      params.push(tenantId);
      tenantClause = ` AND terminal.tenant_id = $${params.length}`;
    }

    const result = await this.query<PosTerminalRecord>(
      `${this.selectTerminalSql()}
      WHERE terminal.id = $1
        ${tenantClause}
      LIMIT 1`,
      params
    );
    return result.rows[0] ?? null;
  }

  async findByCode(tenantId: string, branchId: string, code: string) {
    const result = await this.query<PosTerminalRecord>(
      `${this.selectTerminalSql()}
      WHERE terminal.tenant_id = $1
        AND terminal.branch_id = $2
        AND lower(terminal.code) = lower($3)
      LIMIT 1`,
      [tenantId, branchId, code]
    );
    return result.rows[0] ?? null;
  }

  async findDefaultForBranch(tenantId: string, branchId: string) {
    const result = await this.query<PosTerminalRecord>(
      `${this.selectTerminalSql()}
      WHERE terminal.tenant_id = $1
        AND terminal.branch_id = $2
        AND terminal.active = true
      ORDER BY
        CASE WHEN lower(terminal.code) = 'local-terminal' THEN 0 ELSE 1 END,
        terminal.created_at ASC
      LIMIT 1`,
      [tenantId, branchId]
    );
    return result.rows[0] ?? null;
  }

  async create(data: CreatePosTerminalInput) {
    const result = await this.query<{ id: string }>(
      `INSERT INTO public.pos_terminals (
        tenant_id,
        branch_id,
        code,
        name,
        description,
        active,
        mode
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id`,
      [
        data.tenantId,
        data.branchId,
        data.code,
        data.name,
        data.description,
        data.active,
        data.mode,
      ]
    );
    return this.findById(result.rows[0].id, data.tenantId);
  }

  async update(id: string, tenantId: string, data: UpdatePosTerminalInput) {
    const updates: string[] = [];
    const params: unknown[] = [id, tenantId];

    const addUpdate = (column: string, value: unknown) => {
      params.push(value);
      updates.push(`${column} = $${params.length}`);
    };

    if (data.branchId !== undefined) addUpdate("branch_id", data.branchId);
    if (data.code !== undefined) addUpdate("code", data.code);
    if (data.name !== undefined) addUpdate("name", data.name);
    if (data.description !== undefined) addUpdate("description", data.description);
    if (data.active !== undefined) addUpdate("active", data.active);
    if (data.mode !== undefined) addUpdate("mode", data.mode);

    if (updates.length === 0) {
      return this.findById(id, tenantId);
    }

    const result = await this.query<{ id: string }>(
      `UPDATE public.pos_terminals
      SET ${updates.join(", ")}
      WHERE id = $1 AND tenant_id = $2
      RETURNING id`,
      params
    );
    return result.rows[0] ? this.findById(result.rows[0].id, tenantId) : null;
  }

  async findSettingsByTerminalId(terminalId: string) {
    const result = await this.query<PosTerminalPeripheralSettingsRecord>(
      `SELECT
        id,
        terminal_id,
        printer_device_id,
        cash_drawer_device_id,
        scale_device_id,
        scanner_device_id,
        enable_print_sale,
        enable_print_purchase,
        enable_print_order,
        enable_open_drawer,
        enable_scale,
        enable_scanner,
        created_at,
        updated_at
      FROM public.pos_terminal_peripheral_settings
      WHERE terminal_id = $1
      LIMIT 1`,
      [terminalId]
    );
    return result.rows[0] ?? null;
  }

  async upsertSettings(terminalId: string, data: UpsertPeripheralSettingsInput) {
    const result = await this.query<{ id: string }>(
      `INSERT INTO public.pos_terminal_peripheral_settings (
        terminal_id,
        printer_device_id,
        cash_drawer_device_id,
        scale_device_id,
        scanner_device_id,
        enable_print_sale,
        enable_print_purchase,
        enable_print_order,
        enable_open_drawer,
        enable_scale,
        enable_scanner
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (terminal_id) DO UPDATE
        SET printer_device_id = EXCLUDED.printer_device_id,
            cash_drawer_device_id = EXCLUDED.cash_drawer_device_id,
            scale_device_id = EXCLUDED.scale_device_id,
            scanner_device_id = EXCLUDED.scanner_device_id,
            enable_print_sale = EXCLUDED.enable_print_sale,
            enable_print_purchase = EXCLUDED.enable_print_purchase,
            enable_print_order = EXCLUDED.enable_print_order,
            enable_open_drawer = EXCLUDED.enable_open_drawer,
            enable_scale = EXCLUDED.enable_scale,
            enable_scanner = EXCLUDED.enable_scanner
      RETURNING id`,
      [
        terminalId,
        data.printerDeviceId,
        data.cashDrawerDeviceId,
        data.scaleDeviceId,
        data.scannerDeviceId,
        data.enablePrintSale,
        data.enablePrintPurchase,
        data.enablePrintOrder,
        data.enableOpenDrawer,
        data.enableScale,
        data.enableScanner,
      ]
    );
    return result.rows[0] ? this.findSettingsByTerminalId(terminalId) : null;
  }
}
