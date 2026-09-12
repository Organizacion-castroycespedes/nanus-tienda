"use client";

import { useEffect, useState } from "react";
import type { TerminalResponse } from "../services/terminals.service";
import {
  bindTerminalDevice,
  listTerminalDeviceBindings,
  listTerminalDevices,
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
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");

  const load = async () => {
    try {
      const [nextDevices, nextBindings] = await Promise.all([
        listTerminalDevices(terminal.tenantId),
        listTerminalDeviceBindings({ terminalId: terminal.id }),
      ]);
      setDevices(nextDevices);
      setBindings(nextBindings);
      setError(null);
    } catch {
      setError("No se pudo consultar el vinculo");
    }
  };

  useEffect(() => {
    void load();
  }, [terminal.id, terminal.tenantId]);

  const active = bindings.find((binding) => binding.status === "ACTIVE");

  const act = async () => {
    if (!selected) return;
    try {
      await bindTerminalDevice(terminal.id, selected);
      setSelected("");
      await load();
    } catch {
      setError("No se pudo vincular el dispositivo");
    }
  };

  const unbind = async () => {
    if (!active) return;
    try {
      await unbindTerminalDevice(terminal.id, active.device_id);
      await load();
    } catch {
      setError("No se pudo desvincular el dispositivo");
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
      <div className="mt-4 grid gap-3 text-sm">
        <div><strong>Estado del vinculo:</strong> {active ? `Vinculado (${active.device_id})` : "Sin dispositivo"}</div>
        <div><strong>Dispositivos registrados:</strong> {devices.length}</div>
        <div className="flex flex-wrap gap-2">
          <select className="rounded border p-2" value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">Seleccionar dispositivo</option>
            {devices.filter((device) => device.registration_status !== "REVOKED").map((device) => (
              <option key={device.id} value={device.id}>{device.id} · {device.registration_status}</option>
            ))}
          </select>
          <button className="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" disabled={!selected || Boolean(active)} onClick={() => void act()}>Vincular</button>
          {active ? <button className="rounded border px-3 py-2" onClick={() => void unbind()}>Desvincular</button> : null}
        </div>
      </div>
    </section>
  );
};
