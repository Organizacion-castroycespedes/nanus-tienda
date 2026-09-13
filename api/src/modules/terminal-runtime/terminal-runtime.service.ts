import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { TerminalDevicesRepository } from "../terminal-devices/terminal-devices.repository";
import type { ResolveTerminalRuntimeDto } from "./dto/resolve-terminal-runtime.dto";

export type TerminalRuntimeResolution =
  | {
      resolution: "CONFIGURED";
      deviceStatus: "BOUND";
      terminal: { terminalId: string; branchId: string; active: true };
    }
  | {
      resolution:
        | "DEVICE_UNKNOWN"
        | "DEVICE_UNBOUND"
        | "DEVICE_REVOKED"
        | "TERMINAL_UNKNOWN"
        | "TERMINAL_DISABLED";
    };

type RuntimeActor = { tenantId?: string };

@Injectable()
export class TerminalRuntimeService {
  constructor(
    @Inject(TerminalDevicesRepository)
    private readonly devices: TerminalDevicesRepository,
  ) {}

  async resolve(
    payload: ResolveTerminalRuntimeDto,
    actor: RuntimeActor,
  ): Promise<TerminalRuntimeResolution> {
    const installationId =
      typeof payload?.installationId === "string"
        ? payload.installationId.trim()
        : "";
    if (!installationId || installationId.length > 255) {
      throw new BadRequestException("installationId invalido");
    }
    if (!actor.tenantId) {
      throw new BadRequestException("Tenant requerido");
    }

    const record = await this.devices.findRuntimeResolution(
      installationId,
      actor.tenantId,
    );
    if (!record) return { resolution: "DEVICE_UNKNOWN" };
    if (record.registration_status === "REVOKED") {
      return { resolution: "DEVICE_REVOKED" };
    }
    if (!record.binding_terminal_id) {
      return { resolution: "DEVICE_UNBOUND" };
    }
    if (!record.terminal_id) {
      return { resolution: "TERMINAL_UNKNOWN" };
    }
    if (!record.terminal_is_active) {
      return { resolution: "TERMINAL_DISABLED" };
    }
    if (!record.branch_id) {
      return { resolution: "TERMINAL_UNKNOWN" };
    }
    return {
      resolution: "CONFIGURED",
      deviceStatus: "BOUND",
      terminal: {
        terminalId: record.terminal_id,
        branchId: record.branch_id,
        active: true,
      },
    };
  }
}
