import { ConflictException, BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../../common/db/database.service";
import { AuditService } from "../../common/services/audit.service";
import { TerminalDevicesRepository } from "./terminal-devices.repository";
import type { RegisterTerminalDeviceDto } from "./dto/register-terminal-device.dto";
import type { CreateTerminalDeviceBindingDto, TerminalDeviceBindingActionDto } from "./dto/terminal-device-binding.dto";

type Actor = { roles: string[]; tenantId?: string; userId?: string };

@Injectable()
export class TerminalDevicesService {
  constructor(@Inject(TerminalDevicesRepository) private readonly repo: TerminalDevicesRepository, @Inject(DatabaseService) private readonly db: DatabaseService, @Inject(AuditService) private readonly audit: AuditService) {}
  private tenant(actor: Actor, requested?: string) {
    if (actor.roles.includes("SUPER_ADMIN")) return requested ?? actor.tenantId ?? (() => { throw new BadRequestException("Tenant requerido"); })();
    if (!actor.tenantId || (requested && requested !== actor.tenantId)) throw new ForbiddenException("No autorizado para este tenant");
    return actor.tenantId;
  }
  async register(payload: RegisterTerminalDeviceDto, actor: Actor) {
    const installationId = payload.installationId?.trim(); if (!installationId) throw new BadRequestException("installationId requerido");
    const tenantId = this.tenant(actor, payload.tenantId); const client = await this.db.getClient();
    try { await client.query("BEGIN"); const current = await this.repo.findByInstallation(installationId, client);
      if (current && current.tenant_id !== tenantId) throw new ConflictException("Installation no disponible");
      if (current?.registration_status === "REVOKED") throw new ConflictException("Device revocado");
      const device = current
        ? await this.repo.touch(client, current.id, { platform: payload.platform, runtimeVersion: payload.runtimeVersion, agentApiVersion: payload.agentApiVersion })
        : await this.repo.register(client, { tenantId, installationId, platform: payload.platform, runtimeVersion: payload.runtimeVersion, agentApiVersion: payload.agentApiVersion });
      await client.query("COMMIT"); return device;
    } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  }
  async list(actor: Actor, tenantId?: string) { return this.repo.listByTenant(this.tenant(actor, tenantId)); }
  async get(deviceId: string, actor: Actor) { const d = await this.repo.findById(deviceId); if (!d) throw new NotFoundException("Device no encontrado"); if (d.tenant_id !== this.tenant(actor, d.tenant_id)) throw new ForbiddenException("No autorizado"); return d; }
  async bindings(actor: Actor, terminalId?: string, deviceId?: string) { return this.repo.listBindings(this.tenant(actor), terminalId, deviceId); }
  private async change(payload: TerminalDeviceBindingActionDto, actor: Actor, status: "UNBOUND" | "REVOKED") {
    const tenantId = this.tenant(actor); const client = await this.db.getClient();
    try { await client.query("BEGIN"); const binding = await this.repo.findActiveByTerminal(payload.terminalId, client);
      if (!binding || binding.device_id !== payload.deviceId || binding.tenant_id !== tenantId) throw new NotFoundException("Vinculo activo no encontrado");
      const updated = await this.repo.updateBinding(client, binding.id, status); await this.repo.updateDeviceStatus(client, payload.deviceId, status === "REVOKED" ? "REVOKED" : "UNBOUND"); await client.query("COMMIT");
      this.audit.logEvent({ tenantId, userId: actor.userId ?? null, module: "terminal-devices", entity: "terminal_device_bindings", entityId: binding.id, action: `DEVICE_${status}` }); return updated;
    } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  }
  async bind(payload: CreateTerminalDeviceBindingDto, actor: Actor) {
    const tenantId = this.tenant(actor); const client = await this.db.getClient();
    try { await client.query("BEGIN"); const terminal = await this.repo.findTerminal(payload.terminalId, client); const device = await this.repo.findById(payload.deviceId, client);
      if (!terminal || !device) throw new NotFoundException("Terminal o device no encontrado"); if (terminal.tenant_id !== tenantId || device.tenant_id !== tenantId) throw new ForbiddenException("Tenant invalido"); if (!terminal.is_active) throw new ConflictException("Terminal inactivo"); if (device.registration_status === "REVOKED") throw new ConflictException("Device revocado");
      if (await this.repo.findActiveByTerminal(payload.terminalId, client) || await this.repo.findActiveByDevice(payload.deviceId, client)) throw new ConflictException("Ya existe un vinculo activo");
      const binding = await this.repo.createBinding(client, tenantId, payload.terminalId, payload.deviceId); await this.repo.updateDeviceStatus(client, payload.deviceId, "BOUND"); await client.query("COMMIT"); return binding;
    } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  }

  async registerCredential(payload: { deviceId: string; credentialId: string; verifierSha256: string; expiresAt?: string | null }, actor: Actor) {
    const tenantId = this.tenant(actor); if (!payload.credentialId?.trim()) throw new BadRequestException("credentialId required"); if (!/^[0-9a-f]{64}$/i.test(payload.verifierSha256)) throw new BadRequestException("verifierSha256 must be SHA-256 hex");
    const client = await this.db.getClient(); try { await client.query("BEGIN"); const record = await this.repo.createCredential(client, { tenantId, deviceId: payload.deviceId, credentialId: payload.credentialId.trim(), verifierSha256: payload.verifierSha256.toLowerCase(), expiresAt: payload.expiresAt, actorId: actor.userId }); if (!record) throw new NotFoundException("Active terminal device not found"); await client.query("COMMIT"); return record; } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  }
  credentials(actor: Actor, deviceId?: string) { return this.repo.listCredentials(this.tenant(actor), deviceId); }
  async revokeCredential(credentialId: string, actor: Actor) { const client = await this.db.getClient(); try { await client.query("BEGIN"); const record = await this.repo.revokeCredential(client, this.tenant(actor), credentialId, actor.userId); if (!record) throw new NotFoundException("Credential not found"); await client.query("COMMIT"); return record; } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); } }
  async bindScale(payload: { branchId: string; posTerminalId: string; operationalTerminalId: string; deviceId: string; logicalScaleId: string }, actor: Actor) { if (!payload.logicalScaleId?.trim()) throw new BadRequestException("logicalScaleId required"); const client = await this.db.getClient(); try { await client.query("BEGIN"); const record = await this.repo.createScaleBinding(client, { tenantId: this.tenant(actor), ...payload, logicalScaleId: payload.logicalScaleId.trim(), actorId: actor.userId }); if (!record) throw new ConflictException("Terminal, Agent binding or SCALE is not eligible"); await client.query("COMMIT"); return record; } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); } }
  scaleBindings(actor: Actor, terminalId?: string) { return this.repo.listScaleBindings(this.tenant(actor), terminalId); }
  async revokeScale(bindingId: string, actor: Actor) { const client = await this.db.getClient(); try { await client.query("BEGIN"); const record = await this.repo.revokeScaleBinding(client, this.tenant(actor), bindingId, actor.userId); if (!record) throw new NotFoundException("SCALE binding not found"); await client.query("COMMIT"); return record; } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); } }
  unbind(payload: TerminalDeviceBindingActionDto, actor: Actor) { return this.change(payload, actor, "UNBOUND"); }
  revoke(payload: TerminalDeviceBindingActionDto, actor: Actor) { return this.change(payload, actor, "REVOKED"); }
}
