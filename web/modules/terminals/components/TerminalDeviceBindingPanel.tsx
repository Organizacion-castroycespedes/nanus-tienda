"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Laptop, Link2, Unlink } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { Modal } from "../../../components/design-system/Modal";
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
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [nextDevices, nextBindings] = await Promise.all([
        listTerminalDevices(terminal.tenantId),
        listTerminalDeviceBindings({ terminalId: terminal.id }),
      ]);
      setDevices(nextDevices);
      setBindings(nextBindings);
      setError(null);
    } catch {
      setError("No se pudo consultar el vínculo del dispositivo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [terminal.id, terminal.tenantId]);

  const active = bindings.find((binding) => binding.status === "ACTIVE");

  const act = async () => {
    if (!selected) return;
    setActionLoading(true);
    setError(null);
    try {
      await bindTerminalDevice(terminal.id, selected);
      setSelected("");
      await load();
    } catch {
      setError("No se pudo vincular el dispositivo.");
    } finally {
      setActionLoading(false);
    }
  };

  const unbind = async () => {
    if (!active) return;
    setActionLoading(true);
    setError(null);
    try {
      await unbindTerminalDevice(terminal.id, active.device_id);
      await load();
    } catch {
      setError("No se pudo desvincular el dispositivo.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Modal
      title="Administrar dispositivo"
      description="El dispositivo se vinculará a este Terminal lógico."
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Terminal Info Cards */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-700 dark:bg-slate-800/50">
            <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Tenant / Sucursal
            </span>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {terminal.tenantName ?? terminal.tenantId}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {terminal.branchName ?? terminal.branchId}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-700 dark:bg-slate-800/50">
            <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Terminal
            </span>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {terminal.name} ({terminal.code})
            </p>
            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
              ID: {terminal.id}
            </p>
          </div>
        </div>

        {/* Binding Status */}
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Laptop className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Estado del vínculo
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {devices.length} dispositivo(s) registrado(s) en este tenant
                </p>
              </div>
            </div>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                active
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {active ? "Vinculado" : "Sin dispositivo"}
            </span>
          </div>

          {active ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-50/60 p-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <span className="font-mono text-xs">
                Device ID: <strong>{active.device_id}</strong>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void unbind()}
                disabled={actionLoading}
                className="text-red-600 hover:text-red-700 dark:text-red-400"
              >
                <Unlink className="h-3.5 w-3.5" />
                {actionLoading ? "Desvinculando..." : "Desvincular"}
              </Button>
            </div>
          ) : null}
        </div>

        {/* Link new device */}
        {!active ? (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Vincular nuevo dispositivo
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
                disabled={loading || actionLoading}
              >
                <option value="">Seleccionar dispositivo disponible</option>
                {devices
                  .filter((device) => device.registration_status !== "REVOKED")
                  .map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.id} · {device.registration_status}
                    </option>
                  ))}
              </select>
              <Button
                onClick={() => void act()}
                disabled={!selected || actionLoading || loading}
                className="shrink-0"
              >
                <Link2 className="h-4 w-4" />
                {actionLoading ? "Vinculando..." : "Vincular"}
              </Button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

