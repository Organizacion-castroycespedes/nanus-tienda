"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Laptop, Link2, Unlink } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { Modal } from "../../../components/design-system/Modal";
import { fetchPeripheralHealth } from "../../../domains/peripherals/api";
import type { PeripheralAgentHealth } from "../../../domains/peripherals/types";
import { isConfirmCancelledError, useConfirm } from "../../../hooks/use-confirm";
import type { TerminalResponse } from "../services/terminals.service";
import { listTerminals } from "../services/terminals.service";
import {
  bindTerminalDevice,
  listTerminalDeviceBindings,
  listTerminalDevices,
  registerTerminalDevice,
  unbindTerminalDevice,
  type TerminalDevice,
  type TerminalDeviceBinding,
} from "../services/terminal-devices.service";

export const TerminalDeviceBindingPanel = ({ terminal, onClose }: { terminal: TerminalResponse; onClose: () => void }) => {
  const [devices, setDevices] = useState<TerminalDevice[]>([]);
  const [bindings, setBindings] = useState<TerminalDeviceBinding[]>([]);
  const [terminals, setTerminals] = useState<TerminalResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [installationId, setInstallationId] = useState("");
  const [agentHealth, setAgentHealth] = useState<PeripheralAgentHealth | null>(null);
  const [registrationConfirmed, setRegistrationConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const confirm = useConfirm();
  const formatDeviceId = (id: string) => id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;

  const load = async () => {
    setLoading(true);
    try {
      const [nextDevices, nextBindings, nextTerminals] = await Promise.all([
        listTerminalDevices(terminal.tenantId),
        listTerminalDeviceBindings(),
        listTerminals({ tenantId: terminal.tenantId, branchId: terminal.branchId }),
      ]);
      setDevices(nextDevices); setBindings(nextBindings); setTerminals(nextTerminals); setError(null);
    } catch { setError("No se pudo consultar el vinculo del dispositivo."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [terminal.id, terminal.tenantId, terminal.branchId]);

  const active = bindings.find((binding) => binding.status === "ACTIVE" && binding.terminal_id === terminal.id);
  const activeByDevice = new Map(bindings.filter((binding) => binding.status === "ACTIVE").map((binding) => [binding.device_id, binding]));
  const terminalById = new Map(terminals.map((item) => [item.id, item]));

  const act = async () => {
    if (!selected || active || actionLoading || registering) return;
    const selectedDevice = devices.find((device) => device.id === selected);
    if (!selectedDevice || activeByDevice.has(selected)) return;
    setActionLoading(true); setError(null);
    try {
      await confirm({ title: `Vincular Device a ${terminal.code}`, description: `Destino: ${terminal.name} (${terminal.code})\nSucursal: ${terminal.branchName ?? terminal.branchId}\nTenant: ${terminal.tenantName ?? terminal.tenantId}\nDevice: ${formatDeviceId(selectedDevice.id)}\n\nLa vinculacion es administrativa. installationId no es una credencial fisica.`, confirmText: `Vincular a ${terminal.code}`, variant: "warning" });
      await bindTerminalDevice(terminal.id, selected); setSelected(""); await load();
    } catch (requestError) { if (!isConfirmCancelledError(requestError)) setError("No se pudo vincular el dispositivo."); }
    finally { setActionLoading(false); }
  };

  const detectLocalAgent = async () => {
    setDetecting(true); setError(null); setNotice(null);
    try {
      const health = await fetchPeripheralHealth();
      const detected = health.agentInstallationId?.trim() ?? "";
      if (!detected) throw new Error("El Agent no anuncio installationId");
      setAgentHealth(health); setInstallationId(detected); setRegistrationConfirmed(false); setNotice("Identidad local detectada. Confirma el registro antes de continuar.");
    } catch { setAgentHealth(null); setInstallationId(""); setError("No se pudo leer la identidad del Peripheral Agent local."); }
    finally { setDetecting(false); }
  };

  const register = async () => {
    const normalized = installationId.trim();
    if (!normalized || !registrationConfirmed || registering) return;
    setRegistering(true); setError(null); setNotice(null);
    try {
      await confirm({ title: "Registrar computador", description: `Tenant: ${terminal.tenantName ?? terminal.tenantId}\nSucursal: ${terminal.branchName ?? terminal.branchId}\nIdentidad: ${formatDeviceId(normalized)}\n\ninstallationId es un identificador de busqueda, no una credencial fisica.`, confirmText: "Registrar Device", variant: "default" });
      const device = await registerTerminalDevice({ installationId: normalized, tenantId: terminal.tenantId, platform: agentHealth?.platform, runtimeVersion: agentHealth?.version, agentApiVersion: agentHealth?.agentApiVersion });
      setSelected(device.id); setRegistrationConfirmed(false); setNotice("Device registrado. Revisa el dispositivo y confirma Vincular."); await load();
    } catch (requestError) { if (!isConfirmCancelledError(requestError)) setError("No se pudo registrar el dispositivo. Puede pertenecer a otro tenant o estar revocado."); }
    finally { setRegistering(false); }
  };

  const unbind = async () => {
    if (!active || actionLoading) return;
    setActionLoading(true); setError(null);
    try {
      await confirm({ title: `Desvincular Device de ${terminal.code}`, description: `Terminal actual: ${terminal.name} (${terminal.code})\nDevice: ${formatDeviceId(active.device_id)}\n\nEsta accion conserva el Device y su historial. No revoca ni elimina el registro.`, confirmText: `Desvincular de ${terminal.code}`, variant: "warning" });
      await unbindTerminalDevice(terminal.id, active.device_id); await load();
    } catch (requestError) { if (!isConfirmCancelledError(requestError)) setError("No se pudo desvincular el dispositivo."); }
    finally { setActionLoading(false); }
  };

  return <Modal title="Administrar dispositivo" description="El dispositivo se vinculara a este Terminal logico." onClose={onClose} size="lg" footer={<div className="flex justify-end"><Button variant="ghost" onClick={onClose}>Cerrar</Button></div>}>
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border p-3.5"><span className="text-xs uppercase tracking-wide text-slate-500">Tenant / Sucursal</span><p className="mt-1 text-sm font-semibold">{terminal.tenantName ?? terminal.tenantId}</p><p className="text-xs text-slate-600">{terminal.branchName ?? terminal.branchId}</p></div><div className="rounded-xl border p-3.5"><span className="text-xs uppercase tracking-wide text-slate-500">Terminal</span><p className="mt-1 text-sm font-semibold">{terminal.name} ({terminal.code})</p><p className="font-mono text-xs text-slate-500">ID: {terminal.id}</p></div></div>
      <div className="rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><Laptop className="h-5 w-5 text-slate-500" /><div><p className="text-sm font-semibold">Estado del vinculo</p><p className="text-xs text-slate-500">{devices.length} dispositivo(s) registrado(s) en este tenant</p></div></div><span className="rounded-full border px-2.5 py-1 text-xs font-semibold">{active ? "Vinculado" : "Sin dispositivo"}</span></div>{active ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-50 p-3 text-sm"><span className="font-mono text-xs">Device ID: <strong>{active.device_id}</strong></span><Button variant="outline" size="sm" onClick={() => void unbind()} disabled={actionLoading}><Unlink className="h-3.5 w-3.5" />{actionLoading ? "Desvinculando..." : "Desvincular"}</Button></div> : null}</div>
      <div className="space-y-3 rounded-xl border p-4"><p className="text-sm font-semibold">Registrar computador</p><p className="text-xs text-slate-600">Detecta el Agent local o escribe su installationId. No es una credencial.</p><div className="grid gap-2 sm:grid-cols-[1fr_auto]"><input className="rounded border p-2 font-mono text-xs" value={installationId} onChange={(event) => { setInstallationId(event.target.value); setAgentHealth(null); setRegistrationConfirmed(false); }} placeholder="installationId" aria-label="installationId del Peripheral Agent" disabled={registering} /><Button variant="outline" onClick={() => void detectLocalAgent()} disabled={detecting || registering}>{detecting ? "Detectando..." : "Detectar Agent local"}</Button></div>{agentHealth ? <p className="text-xs text-slate-600">Agent {agentHealth.version} - API {agentHealth.agentApiVersion} - {agentHealth.platform ?? "plataforma no indicada"}</p> : null}<label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={registrationConfirmed} onChange={(event) => setRegistrationConfirmed(event.target.checked)} disabled={!installationId.trim() || registering} /><span>Confirmo que este Device pertenece al computador autorizado y al tenant mostrado.</span></label><Button onClick={() => void register()} disabled={!installationId.trim() || !registrationConfirmed || registering || actionLoading}>{registering ? "Registrando..." : "Registrar Device"}</Button></div>
      {!active ? <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><select className="w-full rounded-xl border px-3 py-2 text-sm" value={selected} onChange={(event) => setSelected(event.target.value)} disabled={loading || actionLoading || registering}><option value="">Seleccionar dispositivo disponible</option>{devices.filter((device) => device.registration_status !== "REVOKED").map((device) => { const deviceBinding = activeByDevice.get(device.id); const boundTerminal = deviceBinding ? terminalById.get(deviceBinding.terminal_id) : null; return <option key={device.id} value={device.id} disabled={Boolean(deviceBinding)}>{formatDeviceId(device.id)} - {device.registration_status}{boundTerminal ? ` - ACTIVE en ${boundTerminal.code}` : deviceBinding ? " - ACTIVE en otra terminal" : ""}</option>; })}</select><Button onClick={() => void act()} disabled={!selected || actionLoading || loading || registering}><Link2 className="h-4 w-4" />{actionLoading ? "Vinculando..." : "Vincular"}</Button></div> : null}
      {error ? <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div> : null}{notice ? <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">{notice}</p> : null}
    </div>
  </Modal>;
};
