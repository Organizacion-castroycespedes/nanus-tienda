import { Injectable } from "@nestjs/common";
import { PosTerminalsService, type PosTerminalSettingsDto } from "./pos-terminals.service";

type PeripheralActor = { roles: string[]; tenantId?: string; userId?: string };

/** Single application seam shared by installer onboarding and POS administration. */
@Injectable()
export class PeripheralConfigurationFacade {
  constructor(private readonly terminals: PosTerminalsService) {}

  listTerminalPeripheralConfiguration(terminalId: string, actor: PeripheralActor) {
    return this.terminals.getPeripheralSettings(terminalId, actor);
  }

  getTerminalPeripheralConfiguration(terminalId: string, actor: PeripheralActor) {
    return this.terminals.getPeripheralSettings(terminalId, actor);
  }

  saveConfiguration(terminalId: string, settings: PosTerminalSettingsDto, actor: PeripheralActor) {
    return this.terminals.savePeripheralSettings(terminalId, settings, actor);
  }

  createPeripheralConfiguration(terminalId: string, settings: PosTerminalSettingsDto, actor: PeripheralActor) {
    return this.saveConfiguration(terminalId, settings, actor);
  }

  updatePeripheralConfiguration(terminalId: string, settings: PosTerminalSettingsDto, actor: PeripheralActor) {
    return this.saveConfiguration(terminalId, settings, actor);
  }

  listTerminalAssignments(terminalId: string, actor: PeripheralActor) {
    return this.terminals.getPeripheralSettings(terminalId, actor);
  }

  setDefaultPrinter(terminalId: string, deviceId: string, actor: PeripheralActor) {
    return this.assignPrinter(terminalId, deviceId, actor);
  }

  assignPrinter(terminalId: string, deviceId: string, actor: PeripheralActor) {
    return this.saveConfiguration(terminalId, { printerDeviceId: deviceId }, actor);
  }

  assignCashDrawer(terminalId: string, deviceId: string, actor: PeripheralActor) {
    return this.saveConfiguration(terminalId, { cashDrawerDeviceId: deviceId }, actor);
  }

  assignScanner(terminalId: string, deviceId: string, actor: PeripheralActor) {
    return this.saveConfiguration(terminalId, { scannerDeviceId: deviceId }, actor);
  }

  assignScale(terminalId: string, deviceId: string, actor: PeripheralActor) {
    return this.saveConfiguration(terminalId, { scaleDeviceId: deviceId }, actor);
  }

  unassignPeripheral(terminalId: string, kind: "printer" | "cashDrawer" | "scanner" | "scale", actor: PeripheralActor) {
    const key: Record<typeof kind, keyof PosTerminalSettingsDto> = { printer: "printerDeviceId", cashDrawer: "cashDrawerDeviceId", scanner: "scannerDeviceId", scale: "scaleDeviceId" };
    return this.saveConfiguration(terminalId, { [key[kind]]: null }, actor);
  }
}
