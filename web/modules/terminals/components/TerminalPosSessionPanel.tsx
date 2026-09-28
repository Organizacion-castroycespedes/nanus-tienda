"use client";

import { RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Textarea } from "../../../components/design-system/Textarea";
import { isConfirmCancelledError, useConfirm } from "../../../hooks/use-confirm";
import {
  closeTerminalPosSession,
  listActiveTerminalPosSessions,
  type TerminalPosSession,
} from "../services/pos-sessions.service";
import type { TerminalResponse } from "../services/terminals.service";

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export const TerminalPosSessionPanel = ({
  terminal,
  onClose,
}: {
  terminal: TerminalResponse;
  onClose: () => void;
}) => {
  const [sessions, setSessions] = useState<TerminalPosSession[]>([]);
  const [reasonBySession, setReasonBySession] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listActiveTerminalPosSessions(terminal.branchId, terminal.id);
      setSessions(result.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron consultar las sesiones POS.");
    } finally {
      setLoading(false);
    }
  }, [terminal.branchId, terminal.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeSession = async (session: TerminalPosSession) => {
    const reason = (reasonBySession[session.id] ?? "").trim();
    if (reason.length < 5) {
      setError("Escribe un motivo administrativo de al menos 5 caracteres.");
      return;
    }
    if (!session.canClose) {
      setError("La API indica que esta sesión tiene caja u operaciones pendientes.");
      return;
    }

    setClosingId(session.id);
    setError(null);
    try {
      await confirm({
        title: `Cerrar sesión POS de ${terminal.code}`,
        description: `Terminal: ${terminal.code} - ${terminal.name}\nUsuario: ${session.userDisplayName ?? session.userEmail ?? "Identidad no disponible"}\nInicio: ${formatDateTime(session.startedAt)}\n\nEsto interrumpe la sesión administrativa. No cierra cajas ni modifica ventas. La sesión cerrada deberá iniciar un contexto POS nuevo.`,
        confirmText: `Cerrar sesión de ${terminal.code}`,
        variant: "warning",
      });
      await closeTerminalPosSession(session.id, {
        branchId: terminal.branchId,
        terminalId: terminal.id,
        reason,
      });
      setReasonBySession((current) => ({ ...current, [session.id]: "" }));
      await load();
    } catch (closeError) {
      if (!isConfirmCancelledError(closeError)) {
        setError(closeError instanceof Error ? closeError.message : "No se pudo cerrar la sesión POS.");
      }
    } finally {
      setClosingId(null);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-amber-200 bg-white p-6 shadow-sm dark:border-amber-900/60 dark:bg-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">Administración excepcional</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Sesiones POS: {terminal.code}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{terminal.name} · {terminal.branchName ?? terminal.branchId}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => void load()} isLoading={loading}>
            <RefreshCw className="h-4 w-4" /> Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={onClose} disabled={Boolean(closingId)}>
            <X className="h-4 w-4" /> Cerrar panel
          </Button>
        </div>
      </div>
      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Consultando sesiones activas...</p> : null}
      {!loading && sessions.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">No hay sesiones POS activas en esta terminal.</p> : null}
      <div className="space-y-4">
        {sessions.map((session) => (
          <article key={session.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                <p className="font-semibold text-slate-900 dark:text-white">{session.userDisplayName ?? session.userEmail ?? "Identidad no disponible"}</p>
                <p>Inicio: {formatDateTime(session.startedAt)}</p>
                <p>Estado: {session.isActive ? "Activa" : "Inactiva"}</p>
                <p>Caja abierta: {session.hasOpenCash ? "Sí" : "No"} · Operaciones pendientes: {session.hasPendingOperations ? "Sí" : "No"}</p>
              </div>
              <span className={`h-fit rounded-full px-2.5 py-1 text-xs font-semibold ${session.canClose ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {session.canClose ? "Cierre permitido" : "Revisión requerida"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <Textarea
                label="Motivo administrativo"
                value={reasonBySession[session.id] ?? ""}
                onChange={(event) => setReasonBySession((current) => ({ ...current, [session.id]: event.target.value }))}
                placeholder="Ej. sesión quedó activa después del cierre operativo"
                maxLength={500}
                rows={2}
                disabled={Boolean(closingId)}
              />
              <Button variant="warning" onClick={() => void closeSession(session)} disabled={Boolean(closingId) || !session.canClose} isLoading={closingId === session.id}>
                Cerrar esta sesión
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
