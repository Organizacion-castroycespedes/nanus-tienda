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
  type OperationalTerminalRecord,
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
  operationalTerminalId?: string | null;
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
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  private async resolveTenantIdForRequest(actor: ActorContext, requestedTenantId?: string) {
    const normalized = this.normalizeOptionalText(requestedTenantId);
    if (!normalized || this.isUuid(normalized)) {
      return this.resolveTenantId(actor, normalized ?? undefined);
    }
    return this.accessControl.resolveTenantIdFromSlug(actor, normalized);
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

  private normalizeOptionalSetting(
    value: string | null | undefined,
    fallback: string | null
  ) {
    if (value === undefined) {
      return fallback;
    }
    if (value === null) {
      return null;
    }
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private normalizeMode(mode: PosTerminalMode | undefined) {
    const normalized = mode ?? "MOCK";
    if (!allowedModes.includes(normalized)) {
      throw new BadRequestException("mode must be MOCK, REAL or HYBRID");
    }
    return normalized;
  }

  private isUuid(value: string) {
    return UUID_PATTERN.test(value);
  }

  private normalizeSettings(
    payload: PosTerminalSettingsDto = {}
  ): UpsertPeripheralSettingsInput {
    return {
      printerDeviceId: this.normalizeOptionalSetting(
        payload.printerDeviceId,
        fallbackSettings.printerDeviceId
      ),
      cashDrawerDeviceId: this.normalizeOptionalSetting(
        payload.cashDrawerDeviceId,
        fallbackSettings.cashDrawerDeviceId
      ),
      scaleDeviceId: this.normalizeOptionalSetting(
        payload.scaleDeviceId,
        fallbackSettings.scaleDeviceId
      ),
      scannerDeviceId: this.normalizeOptionalSetting(
        payload.scannerDeviceId,
        fallbackSettings.scannerDeviceId
      ),
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

  private async assertOperationalTerminalLink(
    tenantId: string,
    branchId: string,
    operationalTerminalId: string | null
  ) {
    if (!operationalTerminalId) {
      return;
    }

    if (!this.isUuid(operationalTerminalId)) {
      throw new BadRequestException("operationalTerminalId must be a UUID");
    }

    const operationalTerminal = await this.repository.findOperationalTerminalById(
      operationalTerminalId,
      tenantId
    );
    if (!operationalTerminal) {
      throw new BadRequestException("operationalTerminalId does not belong to tenant");
    }
    if (operationalTerminal.branch_id !== branchId) {
      throw new BadRequestException(
        "operationalTerminalId does not belong to POS terminal branch"
      );
    }
    if (!operationalTerminal.is_active) {
      throw new BadRequestException("operationalTerminalId must be active");
    }
  }

  private mapTerminal(record: PosTerminalRecord) {
    return {
      id: record.id,
      tenantId: record.tenant_id,
      branchId: record.branch_id,
      branchName: record.branch_name,
      operationalTerminalId: record.operational_terminal_id,
      operationalTerminalCode: record.operational_terminal_code,
      operationalTerminalName: record.operational_terminal_name,
      operationalTerminalActive: record.operational_terminal_active,
      code: record.code,
      name: record.name,
      description: record.description,
      active: record.active,
      mode: record.mode,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private mapSettings(
    record: PosTerminalPeripheralSettingsRecord | null,
    useMockDefaults = true
  ) {
    const fallbackDevice = (deviceId: string | null) =>
      useMockDefaults ? deviceId : null;
    const settings = record
      ? {
          printerDeviceId:
            record.printer_device_id ??
            fallbackDevice(fallbackSettings.printerDeviceId),
          cashDrawerDeviceId:
            record.cash_drawer_device_id ??
            fallbackDevice(fallbackSettings.cashDrawerDeviceId),
          scaleDeviceId:
            record.scale_device_id ?? fallbackDevice(fallbackSettings.scaleDeviceId),
          scannerDeviceId:
            record.scanner_device_id ??
            fallbackDevice(fallbackSettings.scannerDeviceId),
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
          printerDeviceId: useMockDefaults ? fallbackSettings.printerDeviceId : null,
          cashDrawerDeviceId: useMockDefaults
            ? fallbackSettings.cashDrawerDeviceId
            : null,
          scaleDeviceId: useMockDefaults ? fallbackSettings.scaleDeviceId : null,
          scannerDeviceId: useMockDefaults ? fallbackSettings.scannerDeviceId : null,
          enablePrintSale: useMockDefaults,
          enablePrintPurchase: useMockDefaults,
          enablePrintOrder: useMockDefaults,
          enableOpenDrawer: useMockDefaults,
          enableScale: useMockDefaults,
          enableScanner: useMockDefaults,
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
    const mappedSettings = this.mapSettings(
      settings,
      !terminal || terminal.mode === "MOCK"
    );

    if (!terminal) {
      return {
        terminalId: "local-terminal",
        agentTerminalCode: "local-terminal",
        operationalTerminalId: null,
        operationalTerminalCode: null,
        operationalTerminalName: null,
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
      agentTerminalCode: terminal.code,
      operationalTerminalId: terminal.operational_terminal_id,
      operationalTerminalCode: terminal.operational_terminal_code,
      operationalTerminalName: terminal.operational_terminal_name,
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

  private buildOperationalUnconfiguredResponse(
    operationalTerminal: OperationalTerminalRecord,
    peripheralProfile: PosTerminalRecord | null = null
  ) {
    return {
      terminalId: peripheralProfile?.code ?? null,
      agentTerminalCode: peripheralProfile?.code ?? null,
      operationalTerminalId: operationalTerminal.id,
      operationalTerminalCode: operationalTerminal.code,
      operationalTerminalName: operationalTerminal.name,
      posTerminalId: peripheralProfile?.id ?? null,
      tenantId: operationalTerminal.tenant_id,
      branchId: operationalTerminal.branch_id,
      branchName: operationalTerminal.branch_name,
      code: operationalTerminal.code,
      name: operationalTerminal.name,
      mode: peripheralProfile?.mode ?? null,
      active: operationalTerminal.is_active,
      source: "OPERATIONAL_UNCONFIGURED" as const,
      ...this.mapSettings(null, false),
    };
  }

  async listTerminals(
    filters: { tenantId?: string; branchId?: string },
    actor: ActorContext
  ) {
    const tenantId = await this.resolveTenantIdForRequest(actor, filters.tenantId);
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
    const tenantId = await this.resolveTenantIdForRequest(actor, payload.tenantId);
    const branchId = this.normalizeRequiredText(payload.branchId, "branchId is required");
    const operationalTerminalId = this.normalizeOptionalText(
      payload.operationalTerminalId
    );
    const code = this.normalizeRequiredText(payload.code, "code is required");
    const name = this.normalizeRequiredText(payload.name, "name is required");
    const mode = this.normalizeMode(payload.mode);

    await this.assertBranchBelongsToTenant(tenantId, branchId);
    await this.assertCodeUnique(tenantId, branchId, code);
    await this.assertOperationalTerminalLink(
      tenantId,
      branchId,
      operationalTerminalId
    );

    const created = await this.repository.create({
      tenantId,
      branchId,
      operationalTerminalId,
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
    const operationalTerminalId =
      payload.operationalTerminalId !== undefined
        ? this.normalizeOptionalText(payload.operationalTerminalId)
        : current.operational_terminal_id;

    if (payload.branchId !== undefined) {
      await this.assertBranchBelongsToTenant(tenantId, branchId);
    }
    await this.assertCodeUnique(tenantId, branchId, code, id);
    await this.assertOperationalTerminalLink(
      tenantId,
      branchId,
      operationalTerminalId
    );

    const updated = await this.repository.update(id, tenantId, {
      branchId: payload.branchId !== undefined ? branchId : undefined,
      operationalTerminalId:
        payload.operationalTerminalId !== undefined
          ? operationalTerminalId
          : undefined,
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
    return this.mapSettings(await this.repository.findSettingsByTerminalId(id), false);
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
    const existing = await this.repository.findSettingsByTerminalId(id);
    const mergedPayload: PosTerminalSettingsDto = {
      printerDeviceId:
        payload.printerDeviceId === undefined
          ? existing?.printer_device_id
          : payload.printerDeviceId,
      cashDrawerDeviceId:
        payload.cashDrawerDeviceId === undefined
          ? existing?.cash_drawer_device_id
          : payload.cashDrawerDeviceId,
      scaleDeviceId:
        payload.scaleDeviceId === undefined
          ? existing?.scale_device_id
          : payload.scaleDeviceId,
      scannerDeviceId:
        payload.scannerDeviceId === undefined
          ? existing?.scanner_device_id
          : payload.scannerDeviceId,
      enablePrintSale: payload.enablePrintSale ?? existing?.enable_print_sale,
      enablePrintPurchase:
        payload.enablePrintPurchase ?? existing?.enable_print_purchase,
      enablePrintOrder: payload.enablePrintOrder ?? existing?.enable_print_order,
      enableOpenDrawer: payload.enableOpenDrawer ?? existing?.enable_open_drawer,
      enableScale: payload.enableScale ?? existing?.enable_scale,
      enableScanner: payload.enableScanner ?? existing?.enable_scanner,
    };
    const saved = await this.repository.upsertSettings(
      id,
      this.normalizeSettings(mergedPayload)
    );
    return this.mapSettings(saved, false);
  }

  async resolveCurrent(
    filters: ResolveCurrentPosTerminalFilters,
    actor: ActorContext
  ) {
    const tenantId = await this.resolveTenantIdForRequest(actor, filters.tenantId);
    const requestedBranchId = this.normalizeOptionalText(filters.branchId);
    const allowedBranchIds = await this.getAllowedBranchIds(actor, tenantId);
    const requestedTerminalId = this.normalizeOptionalText(filters.terminalId);
    const requestedTerminalCode = this.normalizeOptionalText(filters.terminalCode);

    if (requestedTerminalId && this.isUuid(requestedTerminalId)) {
      const operationalTerminal = await this.repository.findOperationalTerminalById(
        requestedTerminalId,
        tenantId
      );

      if (operationalTerminal) {
        if (
          requestedBranchId !== null &&
          requestedBranchId !== operationalTerminal.branch_id
        ) {
          throw new BadRequestException(
            "terminalId does not belong to requested branch"
          );
        }
        await this.assertBranchAccess(actor, tenantId, operationalTerminal.branch_id);

        const linkedTerminal = await this.repository.findByOperationalTerminalId(
          tenantId,
          operationalTerminal.branch_id,
          operationalTerminal.id
        );
        if (!linkedTerminal) {
          return this.buildOperationalUnconfiguredResponse(operationalTerminal);
        }

        const linkedSettings = await this.repository.findSettingsByTerminalId(
          linkedTerminal.id
        );
        if (!linkedSettings) {
          return this.buildOperationalUnconfiguredResponse(
            operationalTerminal,
            linkedTerminal
          );
        }
        return this.buildResolvedResponse(
          linkedTerminal,
          linkedSettings,
          "CONFIGURED"
        );
      }

      throw new NotFoundException("Operational terminal not found");
    }

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

    let terminal: PosTerminalRecord | null = null;

    if (requestedTerminalId) {
      if (this.isUuid(requestedTerminalId)) {
        terminal = await this.repository.findById(requestedTerminalId, tenantId);
      }

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
