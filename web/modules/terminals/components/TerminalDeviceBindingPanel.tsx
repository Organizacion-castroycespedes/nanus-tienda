"use client";

import { useEffect, useState } from "react";
import { fetchPeripheralHealth } from "../../../domains/peripherals/api";
import type { PeripheralAgentHealth } from "../../../domains/peripherals/types";
import { isConfirmCancelledError, useConfirm } from "../../../hooks/use-confirm";
import {
  listTerminals,
  type TerminalResponse,
} from "../services/terminals.service";
import {
  bindTerminalDevice,
  listTerminalDeviceBindings,
  listTerminalDevices,
  registerTerminalDevice,
  unbindTerminalDevice,
  type TerminalDevice,
  type TerminalDeviceBinding,
} from "../services/terminal-devices.service";

export const TerminalDeviceBindingPanel = ({
  terminal,
  onClose,
}: {
  terminal: TerminalResponse;
  onClose: () => void;
}) => {
  const [devices, setDevices] = useState<TerminalDevice[]>([]);
  const [bindings, setBindings] = useState<TerminalDeviceBinding[]>([]);
  const [terminals, setTerminals] = useState<TerminalResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [installationId, setInstallationId] = useState("");
  const [agentHealth, setAgentHealth] = useState<PeripheralAgentHealth | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [binding, setBinding] = useState(false);
  const [registrationConfirmed, setRegistrationConfirmed] = useState(false);
  const confirm = useConfirm();

  const formatDeviceId = (deviceId: string) =>
    deviceId.length > 12
      ? `${deviceId.slice(0, 8)}...${deviceId.slice(-4)}`
      : deviceId;

  const load = async () => {
    try {
      const [nextDevices, nextBindings, nextTerminals] = await Promise.all([
        listTerminalDevices(terminal.tenantId),
        listTerminalDeviceBindings(),
        listTerminals({ tenantId: terminal.tenantId, branchId: terminal.branchId }),
      ]);
      setDevices(nextDevices);
      setBindings(nextBindings);
      setTerminals(nextTerminals);
      setError(null);
    } catch {
      setError("No se pudo consultar el vinculo");
    }
  };

  useEffect(() => {
    void load();
  }, [terminal.id, terminal.tenantId, terminal.branchId]);

  const active = bindings.find(
    (binding) => binding.status === "ACTIVE" && binding.terminal_id === terminal.id
  );
  const activeByDevice = new Map(
    bindings
      .filter((binding) => binding.status === "ACTIVE")
      .map((binding) => [binding.device_id, binding])
  );
  const terminalById = new Map(terminals.map((item) => [item.id, item]));

  const act = async () => {
    if (!selected || active || binding) return;
    const selectedDevice = devices.find((device) => device.id === selected);
    const existingBinding = activeByDevice.get(selected);
    if (!selectedDevice || existingBinding) return;
    setBinding(true);
    setError(null);
    try {
      await confirm({
        title: `Vincular Device a ${terminal.code}`,
        description: `Destino: ${terminal.name} (${terminal.code})\nSucursal: ${terminal.branchName ?? terminal.branchId}\nTenant: ${terminal.tenantName ?? terminal.tenantId}\nDevice: ${formatDeviceId(selectedDevice.id)} - ${selectedDevice.platform ?? "plataforma no indicada"}\n\nLa vinculacion es administrativa. installationId no es una credencial fisica.`,
        confirmText: `Vincular a ${terminal.code}`,
        variant: "warning",
      });
      await bindTerminalDevice(terminal.id, selected);
      setSelected("");
      await load();
    } catch (error) {
      if (!isConfirmCancelledError(error)) {
        setError("No se pudo vincular el dispositivo");
      }
    } finally {
      setBinding(false);
    }
  };

  const detectLocalAgent = async () => {
    setDetecting(true);
    setError(null);
    setNotice(null);
    try {
      const health = await fetchPeripheralHealth();
      const detectedInstallationId = health.agentInstallationId?.trim() ?? "";
      if (!detectedInstallationId) {
        throw new Error("El Agent no anuncio installationId");
      }
      setAgentHealth(health);
      setInstallationId(detectedInstallationId);
      setRegistrationConfirmed(false);
      setNotice("Identidad local detectada. Confirma el registro antes de continuar.");
    } catch {
      setAgentHealth(null);
      setInstallationId("");
      setError("No se pudo leer la identidad del Peripheral Agent local");
    } finally {
      setDetecting(false);
    }
  };

  const register = async () => {
    const normalizedInstallationId = installationId.trim();
    if (!normalizedInstallationId || !registrationConfirmed || registering) return;

    setRegistering(true);
    setError(null);
    setNotice(null);
    try {
      await confirm({
        title: "Registrar computador",
        description: `Tenant: ${terminal.tenantName ?? terminal.tenantId}\nSucursal: ${terminal.branchName ?? terminal.branchId}\nAgent: ${agentHealth?.version ?? "version no indicada"}\nPlataforma: ${agentHealth?.platform ?? "plataforma no indicada"}\nIdentidad: ${formatDeviceId(normalizedInstallationId)}\n\ninstallationId es un identificador de busqueda, no una credencial fisica.`,
        confirmText: "Registrar Device",
        variant: "default",
      });
      const device = await registerTerminalDevice({
        installationId: normalizedInstallationId,
        tenantId: terminal.tenantId,
        platform: agentHealth?.platform ?? undefined,
        runtimeVersion: agentHealth?.version ?? undefined,
        agentApiVersion: agentHealth?.agentApiVersion ?? undefined,
      });
      setSelected(device.id);
      setRegistrationConfirmed(false);
      setNotice("Device registrado. Revisa el dispositivo y confirma Vincular.");
      await load();
    } catch (error) {
      if (!isConfirmCancelledError(error)) {
        setError("No se pudo registrar el dispositivo. Puede pertenecer a otro tenant o estar revocado.");
      }
    } finally {
      setRegistering(false);
    }
  };

  const unbind = async () => {
    if (!active) return;
    const activeDevice = devices.find((device) => device.id === active.device_id);
    setBinding(true);
    setError(null);
    try {
      await confirm({
        title: `Desvincular Device de ${terminal.code}`,
        description: `Terminal actual: ${terminal.name} (${terminal.code})\nDevice: ${formatDeviceId(active.device_id)} - ${activeDevice?.platform ?? "plataforma no indicada"}\n\nEsta accion conserva el Device y su historial. No revoca ni elimina el registro. Verifica antes que no haya actividad operativa.`,
        confirmText: `Desvincular de ${terminal.code}`,
        variant: "warning",
      });
      await unbindTerminalDevice(terminal.id, active.device_id);
      await load();
    } catch (error) {
      if (!isConfirmCancelledError(error)) {
        setError("No se pudo desvincular el dispositivo");
      }
    } finally {
      setBinding(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Administrar dispositivo</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">El dispositivo se vinculara a este Terminal logico.</p>
        </div>
        <button className="rounded border px-3 py-2 text-sm" onClick={onClose}>Cerrar</button>
      </div>

      <dl className="mt-4 grid gap-2 text-sm md:grid-cols-2">
        <div><dt className="font-semibold">Tenant</dt><dd>{terminal.tenantName ?? terminal.tenantId}</dd></div>
        <div><dt className="font-semibold">Sucursal</dt><dd>{terminal.branchName ?? terminal.branchId}</dd></div>
        <div><dt className="font-semibold">Terminal</dt><dd>{terminal.name}</dd></div>
        <div><dt className="font-semibold">Codigo</dt><dd>{terminal.code}</dd></div>
        <div className="md:col-span-2"><dt className="font-semibold">Terminal ID</dt><dd className="font-mono">{terminal.id}</dd></div>
      </dl>

      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-emerald-700">{notice}</p> : null}
      <div className="mt-4 grid gap-3 text-sm">
        <div><strong>Estado del vinculo:</strong> {active ? `Vinculado (${active.device_id})` : "Sin dispositivo"}</div>
        <div><strong>Dispositivos registrados:</strong> {devices.length}</div>
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p className="font-semibold">Registrar computador</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            Detecta el Agent de este computador o escribe su installationId. No es una credencial.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
            <input
              className="rounded border p-2 font-mono text-xs"
              value={installationId}
              onChange={(event) => {
                setInstallationId(event.target.value);
                setAgentHealth(null);
                setRegistrationConfirmed(false);
              }}
              placeholder="installationId"
              aria-label="installationId del Peripheral Agent"
              disabled={registering}
            />
            <button
              className="rounded border px-3 py-2 disabled:opacity-50"
              onClick={() => void detectLocalAgent()}
              disabled={detecting || registering}
            >
              {detecting ? "Detectando..." : "Detectar Agent local"}
            </button>
          </div>
          {agentHealth ? (
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              Agent {agentHealth.version} · API {agentHealth.agentApiVersion} · {agentHealth.platform ?? "plataforma no indicada"}
            </p>
          ) : null}
          <label className="mt-3 flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={registrationConfirmed}
              onChange={(event) => setRegistrationConfirmed(event.target.checked)}
              disabled={!installationId.trim() || registering}
            />
            <span>Confirmo que este Device pertenece al computador autorizado y al tenant mostrado.</span>
          </label>
          <button
            className="mt-3 rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50"
            onClick={() => void register()}
            disabled={!installationId.trim() || !registrationConfirmed || registering || binding}
          >
            {registering ? "Registrando..." : "Registrar Device"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="rounded border p-2" value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">Seleccionar dispositivo</option>
            {devices
              .filter((device) => device.registration_status !== "REVOKED")
              .map((device) => {
                const deviceBinding = activeByDevice.get(device.id);
                const boundTerminal = deviceBinding
                  ? terminalById.get(deviceBinding.terminal_id)
                  : null;
                return (
                  <option key={device.id} value={device.id} disabled={Boolean(deviceBinding)}>
                    {formatDeviceId(device.id)} · {device.registration_status}
                    {boundTerminal ? ` · ACTIVE en ${boundTerminal.code}` : deviceBinding ? " · ACTIVE en otra terminal" : ""}
                  </option>
                );
              })}
          </select>
          <button className="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" disabled={!selected || Boolean(active) || binding || registering} onClick={() => void act()}>{binding ? "Vinculando..." : "Vincular"}</button>
          {active ? <button className="rounded border px-3 py-2 disabled:opacity-50" disabled={binding} onClick={() => void unbind()}>Desvincular</button> : null}
        </div>
      </div>
    </section>
  );
};
