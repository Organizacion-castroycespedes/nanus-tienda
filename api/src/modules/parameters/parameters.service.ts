import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PoolClient } from "pg";
import {
  ParametersRepository,
  type ParameterMode,
} from "./parameters.repository";

export type ParameterActor = {
  roles: string[];
  userId?: string;
  tenantId?: string;
};

export type ElectronicBillingPolicyFromSettings = {
  enabled: boolean;
  mode: "AUTOMATIC" | "ON_DEMAND";
  rawMode: ParameterMode;
};

const MODE_VALUES = new Set(["DISABLED", "ON_DEMAND", "AUTOMATIC"]);
const DOCUMENT_CODES = [
  "PRINT_TICKET",
  "PRINT_INVOICE",
  "SEND_INVOICE",
  "GENERATE_INVOICE",
  "CONVERT_REMISSION",
] as const;

@Injectable()
export class ParametersService {
  constructor(
    @Inject(ParametersRepository)
    private readonly repository: ParametersRepository
  ) {}

  private isSuperAdmin(actor: ParameterActor) {
    return actor.roles.includes("SUPER_ADMIN");
  }

  private canManageTenantSettings(actor: ParameterActor) {
    return (
      this.isSuperAdmin(actor) ||
      actor.roles.includes("SUPER_USER") ||
      actor.roles.includes("ADMIN")
    );
  }

  async resolveTenantIdForActor(actor: ParameterActor, tenantId?: string) {
    return this.resolveTenantId(actor, tenantId);
  }

  private async resolveTenantId(actor: ParameterActor, tenantId?: string) {
    if (this.isSuperAdmin(actor)) {
      const requestedTenantId = tenantId?.trim();
      const resolved = requestedTenantId
        ? await this.resolveTenantReference(requestedTenantId)
        : actor.tenantId;
      if (!resolved) {
        throw new BadRequestException("tenantId is required");
      }
      return resolved;
    }
    if (!actor.tenantId) {
      throw new ForbiddenException("Tenant requerido");
    }
    const requestedTenantId = tenantId?.trim();
    const resolvedTenantId = await this.resolveTenantReference(requestedTenantId);
    if (requestedTenantId && resolvedTenantId !== actor.tenantId) {
      throw new ForbiddenException("No autorizado para otro tenant");
    }
    return actor.tenantId;
  }

  private async resolveTenantReference(tenantId?: string) {
    if (!tenantId) {
      return null;
    }
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      return tenantId;
    }
    return this.repository.findTenantIdBySlug(tenantId);
  }

  private assertModeValue(value: string) {
    if (!MODE_VALUES.has(value)) {
      throw new BadRequestException(
        "value must be DISABLED, ON_DEMAND or AUTOMATIC"
      );
    }
  }

  listParameters(actor: ParameterActor, includeInactive = false) {
    if (!this.isSuperAdmin(actor) && includeInactive) {
      throw new ForbiddenException("Solo SUPER_ADMIN puede ver parámetros inactivos");
    }
    return this.repository.listParameters(includeInactive || this.isSuperAdmin(actor));
  }

  async createParameter(
    actor: ParameterActor,
    payload: {
      code: string;
      valueType: "MODE" | "BOOLEAN";
      defaultValue: string;
      label: string;
      active?: boolean;
    }
  ) {
    if (!this.isSuperAdmin(actor)) {
      throw new ForbiddenException("Solo SUPER_ADMIN puede crear parámetros");
    }
    const code = payload.code?.trim().toUpperCase();
    const label = payload.label?.trim();
    if (!code) {
      throw new BadRequestException("code is required");
    }
    if (!label) {
      throw new BadRequestException("label is required");
    }
    if (payload.valueType === "MODE") {
      this.assertModeValue(payload.defaultValue);
    } else if (payload.valueType === "BOOLEAN") {
      if (!["true", "false"].includes(payload.defaultValue)) {
        throw new BadRequestException("BOOLEAN defaultValue must be true or false");
      }
    } else {
      throw new BadRequestException("valueType must be MODE or BOOLEAN");
    }

    return this.repository.createParameter({
      code,
      valueType: payload.valueType,
      defaultValue: payload.defaultValue,
      label,
      active: payload.active !== false,
    });
  }

  async updateParameter(
    actor: ParameterActor,
    parameterId: string,
    payload: {
      label?: string;
      defaultValue?: string;
      active?: boolean;
    }
  ) {
    if (!this.isSuperAdmin(actor)) {
      throw new ForbiddenException("Solo SUPER_ADMIN puede editar parámetros");
    }
    const current = await this.repository.findParameterById(parameterId);
    if (!current) {
      throw new NotFoundException("parameter not found");
    }
    if (payload.defaultValue !== undefined) {
      if (current.value_type === "MODE") {
        this.assertModeValue(payload.defaultValue);
      } else if (!["true", "false"].includes(payload.defaultValue)) {
        throw new BadRequestException("BOOLEAN defaultValue must be true or false");
      }
    }

    const updated = await this.repository.updateParameter(parameterId, {
      label: payload.label?.trim(),
      defaultValue: payload.defaultValue,
      active: payload.active,
    });
    if (!updated) {
      throw new NotFoundException("parameter not found");
    }
    return updated;
  }

  async listTenantSettings(
    actor: ParameterActor,
    query: {
      tenantId?: string;
      branchId?: string;
      terminalId?: string;
      scope?: "tenant" | "branch" | "terminal";
    }
  ) {
    if (!this.canManageTenantSettings(actor) && !actor.roles.includes("USER")) {
      throw new ForbiddenException("No autorizado");
    }
    const tenantId = await this.resolveTenantId(actor, query.tenantId);
    const scope = query.scope;
    return this.repository.listTenantSettings({
      tenantId,
      branchId:
        scope === "tenant"
          ? null
          : query.branchId ?? undefined,
      terminalId:
        scope === "tenant" || scope === "branch"
          ? null
          : query.terminalId ?? undefined,
    });
  }

  async upsertTenantSetting(
    actor: ParameterActor,
    payload: {
      tenantId?: string;
      branchId?: string | null;
      terminalId?: string | null;
      parameterId?: string;
      parameterCode?: string;
      value: string;
    }
  ) {
    if (!this.canManageTenantSettings(actor)) {
      throw new ForbiddenException("No autorizado para editar configuración");
    }
    const tenantId = await this.resolveTenantId(actor, payload.tenantId);
    const parameter = payload.parameterId
      ? await this.repository.findParameterById(payload.parameterId)
      : payload.parameterCode
        ? await this.repository.findParameterByCode(payload.parameterCode.trim().toUpperCase())
        : null;
    if (!parameter) {
      throw new NotFoundException("parameter not found");
    }
    if (!parameter.active) {
      throw new BadRequestException("parameter is inactive");
    }
    if (parameter.value_type === "MODE") {
      this.assertModeValue(payload.value);
    } else if (!["true", "false"].includes(payload.value)) {
      throw new BadRequestException("BOOLEAN value must be true or false");
    }

    const branchId = payload.branchId ?? null;
    const terminalId = payload.terminalId ?? null;
    if (terminalId && !branchId) {
      throw new BadRequestException("branchId is required when terminalId is provided");
    }

    return this.repository.upsertTenantSetting({
      tenantId,
      branchId,
      terminalId,
      parameterId: parameter.id,
      value: payload.value,
      updatedByUserId: actor.userId ?? null,
    });
  }

  async resolveValue(
    code: string,
    tenantId: string,
    branchId?: string | null,
    terminalId?: string | null,
    client?: PoolClient
  ): Promise<ParameterMode | string | null> {
    return this.repository.resolveValue(code, tenantId, branchId, terminalId, client);
  }

  async resolveDocumentModes(
    tenantId: string,
    branchId?: string | null,
    terminalId?: string | null,
    client?: PoolClient
  ) {
    const entries = await Promise.all(
      DOCUMENT_CODES.map(async (code) => {
        const value = await this.resolveValue(code, tenantId, branchId, terminalId, client);
        return [code, value ?? "DISABLED"] as const;
      })
    );
    return Object.fromEntries(entries) as Record<(typeof DOCUMENT_CODES)[number], string>;
  }

  async resolveElectronicBillingPolicy(
    tenantId: string,
    branchId?: string | null,
    terminalId?: string | null,
    client?: PoolClient
  ): Promise<ElectronicBillingPolicyFromSettings> {
    const sendMode =
      ((await this.resolveValue(
        "SEND_INVOICE",
        tenantId,
        branchId,
        terminalId,
        client
      )) as ParameterMode | null) ?? "DISABLED";

    if (sendMode === "DISABLED") {
      return { enabled: false, mode: "AUTOMATIC", rawMode: "DISABLED" };
    }

    const raw =
      ((await this.resolveValue(
        "GENERATE_INVOICE",
        tenantId,
        branchId,
        terminalId,
        client
      )) as ParameterMode | null) ?? "AUTOMATIC";

    if (raw === "DISABLED") {
      return { enabled: false, mode: "AUTOMATIC", rawMode: raw };
    }
    return {
      enabled: true,
      mode: raw === "ON_DEMAND" ? "ON_DEMAND" : "AUTOMATIC",
      rawMode: raw,
    };
  }
}
