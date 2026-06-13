import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AccessControlService } from "../../common/services/access-control.service";
import {
  PosTerminalsRepository,
  type PosTerminalMode,
  type PosTerminalPeripheralSettingsRecord,
  type PosTerminalRecord,
  type UpsertPeripheralSettingsInput,
} from "./pos-terminals.repository";

type ActorContext = {
  roles: string[];
  tenantId?: string;
  userId?: string;
};

export type CreatePosTerminalDto = {
  tenantId?: string;
  branchId: string;
  code: string;
  name: string;
  description?: string | null;
  active?: boolean;
  mode?: PosTerminalMode;
};

export type UpdatePosTerminalDto = Partial<Omit<CreatePosTerminalDto, "tenantId">>;

export type PosTerminalSettingsDto = Partial<{
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
}>;

export type ResolveCurrentPosTerminalFilters = {
  tenantId?: string;
  branchId?: string;
  terminalId?: string;
  terminalCode?: string;
};

const allowedModes: PosTerminalMode[] = ["MOCK", "REAL", "HYBRID"];

const fallbackSettings: UpsertPeripheralSettingsInput = {
  printerDeviceId: "mock-printer-001",
  cashDrawerDeviceId: "mock-cashdrawer-001",
  scaleDeviceId: "mock-scale-001",
  scannerDeviceId: "mock-scanner-001",
  enablePrintSale: true,
  enablePrintPurchase: true,
  enablePrintOrder: true,
  enableOpenDrawer: true,
  enableScale: true,
  enableScanner: true,
};

@Injectable()
export class PosTerminalsService {
  constructor(
    @Inject(PosTerminalsRepository)
    private readonly repository: PosTerminalsRepository,
    @Inject(AccessControlService)
    private readonly accessControl: AccessControlService
  ) {}

  private canManageAllTenants(actor: ActorContext) {
    return actor.roles.includes("SUPER_ADMIN");
  }

  private resolveTenantId(actor: ActorContext, requestedTenantId?: string) {
    const normalized = this.normalizeOptionalText(requestedTenantId);
    if (this.canManageAllTenants(actor)) {
      if (normalized) return normalized;
      if (actor.tenantId) return actor.tenantId;
      throw new BadRequestException("tenantId is required");
    }

    if (!actor.tenantId) {
      throw new ForbiddenException("Tenant context is required");
    }
    if (normalized && normalized !== actor.tenantId) {
      throw new ForbiddenException("Tenant scope mismatch");
    }
    return actor.tenantId;
  }

  private async getAllowedBranchIds(actor: ActorContext, tenantId: string) {
    if (actor.roles.includes("SUPER_ADMIN") || actor.roles.includes("SUPER_USER")) {
      return null;
    }
    const branchIds = await this.accessControl.getAccessibleBranchIds(
      { id: actor.userId, tenantId: actor.tenantId, roles: actor.roles },
      tenantId
    );
    if (branchIds.length === 0) {
      throw new ForbiddenException("No assigned branches available");
    }
    return branchIds;
  }

  private async assertBranchAccess(
    actor: ActorContext,
    tenantId: string,
    branchId: string
  ) {
    const allowed = await this.accessControl.canAccessBranch(
      { id: actor.userId, tenantId: actor.tenantId, roles: actor.roles },
      tenantId,
      branchId
    );
    if (!allowed) {
      throw new ForbiddenException("Branch scope mismatch");
    }
  }

  private normalizeRequiredText(value: string | undefined, message: string) {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException(message);
    }
    return normalized;
  }

  private normalizeOptionalText(value: string | null | undefined) {
    if (value === null) return null;
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private normalizeMode(mode: PosTerminalMode | undefined) {
    const normalized = mode ?? "MOCK";
    if (!allowedModes.includes(normalized)) {
      throw new BadRequestException("mode must be MOCK, REAL or HYBRID");
    }
    return normalized;
  }

  private normalizeSettings(
    payload: PosTerminalSettingsDto = {}
  ): UpsertPeripheralSettingsInput {
    return {
      printerDeviceId:
        this.normalizeOptionalText(payload.printerDeviceId) ??
        fallbackSettings.printerDeviceId,
      cashDrawerDeviceId:
        this.normalizeOptionalText(payload.cashDrawerDeviceId) ??
        fallbackSettings.cashDrawerDeviceId,
      scaleDeviceId:
        this.normalizeOptionalText(payload.scaleDeviceId) ??
        fallbackSettings.scaleDeviceId,
      scannerDeviceId:
        this.normalizeOptionalText(payload.scannerDeviceId) ??
        fallbackSettings.scannerDeviceId,
      enablePrintSale: payload.enablePrintSale ?? true,
      enablePrintPurchase: payload.enablePrintPurchase ?? true,
      enablePrintOrder: payload.enablePrintOrder ?? true,
      enableOpenDrawer: payload.enableOpenDrawer ?? true,
      enableScale: payload.enableScale ?? true,
      enableScanner: payload.enableScanner ?? true,
    };
  }

  private async assertBranchBelongsToTenant(tenantId: string, branchId: string) {
    const valid = await this.repository.validateBranch(tenantId, branchId);
    if (!valid) {
      throw new BadRequestException("branchId does not belong to tenant");
    }
  }

  private async assertCodeUnique(
    tenantId: string,
    branchId: string,
    code: string,
    excludeId?: string
  ) {
    const exists = await this.repository.existsCodeInBranch(
      tenantId,
      branchId,
      code,
      excludeId
    );
    if (exists) {
      throw new BadRequestException("terminal code already exists in branch");
    }
  }

  private mapTerminal(record: PosTerminalRecord) {
    return {
      id: record.id,
      tenantId: record.tenant_id,
      branchId: record.branch_id,
      branchName: record.branch_name,
      code: record.code,
      name: record.name,
      description: record.description,
      active: record.active,
      mode: record.mode,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private mapSettings(record: PosTerminalPeripheralSettingsRecord | null) {
    const settings = record
      ? {
          printerDeviceId:
            record.printer_device_id ?? fallbackSettings.printerDeviceId,
          cashDrawerDeviceId:
            record.cash_drawer_device_id ?? fallbackSettings.cashDrawerDeviceId,
          scaleDeviceId: record.scale_device_id ?? fallbackSettings.scaleDeviceId,
          scannerDeviceId:
            record.scanner_device_id ?? fallbackSettings.scannerDeviceId,
          enablePrintSale: record.enable_print_sale,
          enablePrintPurchase: record.enable_print_purchase,
          enablePrintOrder: record.enable_print_order,
          enableOpenDrawer: record.enable_open_drawer,
          enableScale: record.enable_scale,
          enableScanner: record.enable_scanner,
          createdAt: record.created_at,
          updatedAt: record.updated_at,
        }
      : {
          ...fallbackSettings,
          createdAt: null,
          updatedAt: null,
        };

    return {
      printerDeviceId: settings.printerDeviceId,
      cashDrawerDeviceId: settings.cashDrawerDeviceId,
      scaleDeviceId: settings.scaleDeviceId,
      scannerDeviceId: settings.scannerDeviceId,
      features: {
        printSale: settings.enablePrintSale,
        printPurchase: settings.enablePrintPurchase,
        printOrder: settings.enablePrintOrder,
        openDrawer: settings.enableOpenDrawer,
        scale: settings.enableScale,
        scanner: settings.enableScanner,
      },
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  private buildResolvedResponse(
    terminal: PosTerminalRecord | null,
    settings: PosTerminalPeripheralSettingsRecord | null,
    source: "CONFIGURED" | "FALLBACK_MOCK",
    fallbackContext?: {
      tenantId?: string | null;
      branchId?: string | null;
      branchName?: string | null;
    }
  ) {
    const mappedSettings = this.mapSettings(settings);

    if (!terminal) {
      return {
        terminalId: "local-terminal",
        posTerminalId: null,
        tenantId: fallbackContext?.tenantId ?? null,
        branchId: fallbackContext?.branchId ?? null,
        branchName: fallbackContext?.branchName ?? null,
        code: "local-terminal",
        name: "Terminal MOCK local",
        mode: "MOCK" as PosTerminalMode,
        active: true,
        source,
        ...mappedSettings,
      };
    }

    return {
      terminalId: terminal.code,
      posTerminalId: terminal.id,
      tenantId: terminal.tenant_id,
      branchId: terminal.branch_id,
      branchName: terminal.branch_name,
      code: terminal.code,
      name: terminal.name,
      mode: terminal.mode,
      active: terminal.active,
      source,
      ...mappedSettings,
    };
  }

  async listTerminals(
    filters: { tenantId?: string; branchId?: string },
    actor: ActorContext
  ) {
    const tenantId = this.resolveTenantId(actor, filters.tenantId);
    const branchId = this.normalizeOptionalText(filters.branchId) ?? undefined;
    const allowedBranchIds = await this.getAllowedBranchIds(actor, tenantId);
    if (branchId) {
      await this.assertBranchBelongsToTenant(tenantId, branchId);
      await this.assertBranchAccess(actor, tenantId, branchId);
    }
    const terminals = await this.repository.findAll(tenantId, branchId);
    return terminals
      .filter((terminal) =>
        allowedBranchIds ? allowedBranchIds.includes(terminal.branch_id) : true
      )
      .map((terminal) => this.mapTerminal(terminal));
  }

  async getTerminal(id: string, actor: ActorContext) {
    const current = await this.repository.findById(id);
    if (!current) {
      throw new NotFoundException("POS terminal not found");
    }
    const tenantId = this.resolveTenantId(actor, current.tenant_id);
    if (tenantId !== current.tenant_id) {
      throw new ForbiddenException("Tenant scope mismatch");
    }
    return this.mapTerminal(current);
  }

  async createTerminal(payload: CreatePosTerminalDto, actor: ActorContext) {
    const tenantId = this.resolveTenantId(actor, payload.tenantId);
    const branchId = this.normalizeRequiredText(payload.branchId, "branchId is required");
    const code = this.normalizeRequiredText(payload.code, "code is required");
    const name = this.normalizeRequiredText(payload.name, "name is required");
    const mode = this.normalizeMode(payload.mode);

    await this.assertBranchBelongsToTenant(tenantId, branchId);
    await this.assertCodeUnique(tenantId, branchId, code);

    const created = await this.repository.create({
      tenantId,
      branchId,
      code,
      name,
      description: this.normalizeOptionalText(payload.description),
      active: payload.active ?? true,
      mode,
    });
    if (!created) {
      throw new BadRequestException("POS terminal could not be created");
    }

    return this.mapTerminal(created);
  }

  async updateTerminal(id: string, payload: UpdatePosTerminalDto, actor: ActorContext) {
    const current = await this.repository.findById(id);
    if (!current) {
      throw new NotFoundException("POS terminal not found");
    }
    const tenantId = this.resolveTenantId(actor, current.tenant_id);

    const branchId =
      payload.branchId !== undefined
        ? this.normalizeRequiredText(payload.branchId, "branchId is required")
        : current.branch_id;
    const code =
      payload.code !== undefined
        ? this.normalizeRequiredText(payload.code, "code is required")
        : current.code;

    if (payload.branchId !== undefined) {
      await this.assertBranchBelongsToTenant(tenantId, branchId);
    }
    await this.assertCodeUnique(tenantId, branchId, code, id);

    const updated = await this.repository.update(id, tenantId, {
      branchId: payload.branchId !== undefined ? branchId : undefined,
      code: payload.code !== undefined ? code : undefined,
      name:
        payload.name !== undefined
          ? this.normalizeRequiredText(payload.name, "name is required")
          : undefined,
      description:
        payload.description !== undefined
          ? this.normalizeOptionalText(payload.description)
          : undefined,
      active: payload.active,
      mode: payload.mode !== undefined ? this.normalizeMode(payload.mode) : undefined,
    });
    if (!updated) {
      throw new NotFoundException("POS terminal not found");
    }

    return this.mapTerminal(updated);
  }

  async getPeripheralSettings(id: string, actor: ActorContext) {
    const current = await this.repository.findById(id);
    if (!current) {
      throw new NotFoundException("POS terminal not found");
    }
    this.resolveTenantId(actor, current.tenant_id);
    return this.mapSettings(await this.repository.findSettingsByTerminalId(id));
  }

  async savePeripheralSettings(
    id: string,
    payload: PosTerminalSettingsDto,
    actor: ActorContext
  ) {
    const current = await this.repository.findById(id);
    if (!current) {
      throw new NotFoundException("POS terminal not found");
    }
    this.resolveTenantId(actor, current.tenant_id);
    const saved = await this.repository.upsertSettings(
      id,
      this.normalizeSettings(payload)
    );
    return this.mapSettings(saved);
  }

  async resolveCurrent(
    filters: ResolveCurrentPosTerminalFilters,
    actor: ActorContext
  ) {
    const tenantId = this.resolveTenantId(actor, filters.tenantId);
    const requestedBranchId = this.normalizeOptionalText(filters.branchId);
    const allowedBranchIds = await this.getAllowedBranchIds(actor, tenantId);
    const branch =
      requestedBranchId === null
        ? allowedBranchIds
          ? null
          : await this.repository.findPrincipalBranch(tenantId)
        : null;
    const branchId = requestedBranchId ?? branch?.id ?? allowedBranchIds?.[0] ?? null;

    if (branchId) {
      await this.assertBranchBelongsToTenant(tenantId, branchId);
      await this.assertBranchAccess(actor, tenantId, branchId);
    }

    if (!branchId) {
      return this.buildResolvedResponse(null, null, "FALLBACK_MOCK", {
        tenantId,
        branchId: null,
      });
    }

    const requestedTerminalId = this.normalizeOptionalText(filters.terminalId);
    const requestedTerminalCode = this.normalizeOptionalText(filters.terminalCode);
    let terminal: PosTerminalRecord | null = null;

    if (requestedTerminalId) {
      terminal = await this.repository.findById(requestedTerminalId, tenantId);
      if (!terminal) {
        terminal = await this.repository.findByCode(
          tenantId,
          branchId,
          requestedTerminalId
        );
      }
    }

    if (!terminal && requestedTerminalCode) {
      terminal = await this.repository.findByCode(
        tenantId,
        branchId,
        requestedTerminalCode
      );
    }

    if (!terminal) {
      terminal = await this.repository.findDefaultForBranch(tenantId, branchId);
    }

    if (!terminal) {
      return this.buildResolvedResponse(null, null, "FALLBACK_MOCK", {
        tenantId,
        branchId,
        branchName: branch?.nombre ?? null,
      });
    }

    const settings = await this.repository.findSettingsByTerminalId(terminal.id);
    return this.buildResolvedResponse(terminal, settings, "CONFIGURED");
  }
}
