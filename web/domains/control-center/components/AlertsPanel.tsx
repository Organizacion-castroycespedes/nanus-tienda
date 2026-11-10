"use client";

import { useEffect, useState } from "react";
import { BellRing, Mail } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { Toast } from "../../../components/design-system/Toast";
import { getAlertsStatus, runAlerts, sendTestEmail } from "../api";
import { apiErrorMessage } from "../errors";
import type { AlertsStatus } from "../types";
import { Pill } from "./StatusBadge";

/** Estado de las alertas de cobro, ejecución manual y correo de prueba (Cartera). */
export const AlertsPanel = ({ onRun }: { onRun?: () => void }) => {
  const [status, setStatus] = useState<AlertsStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    void getAlertsStatus().then(setStatus).catch((caught) => setError(apiErrorMessage(caught)));
  }, []);

  const run = async () => {
    setRunning(true);
    setError(null);
    setNotice(null);
    try {
      const result = await runAlerts();
      setNotice(
        result.skipped
          ? "Otra ejecución de alertas está en curso; intenta en un momento."
          : `Alertas: ${result.chargesEvaluated} cargo(s) evaluados, ${result.noticesPublished} aviso(s) publicados, ${result.noticesResolved} resueltos, ${result.emailsSent} correo(s) enviados, ${result.emailsFailed} fallidos, ${result.emailsSkipped} omitidos.`,
      );
      onRun?.();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setRunning(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestError(null);
    try {
      const result = await sendTestEmail(testTo.trim());
      setNotice(`Correo de prueba enviado a ${result.to}.`);
      setTestOpen(false);
    } catch (caught) {
      setTestError(apiErrorMessage(caught));
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="mb-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-900 dark:text-white">Alertas de cobro</span>
          {status ? (
            <>
              <Pill tone={status.alertsEnabled ? "ok" : "muted"}>{status.alertsEnabled ? "Automáticas activas" : "Automáticas apagadas"}</Pill>
              <Pill tone={status.emailReady ? "ok" : status.emailEnabled ? "warn" : "muted"}>
                {status.emailReady ? `Correo activo (${status.smtpHost})` : status.emailEnabled ? "Correo sin configurar" : "Correo apagado"}
              </Pill>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => void run()} isLoading={running}>
            <BellRing className="mr-1 h-4 w-4" aria-hidden /> Ejecutar alertas
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setTestOpen(true); setTestError(null); }}>
            <Mail className="mr-1 h-4 w-4" aria-hidden /> Correo de prueba
          </Button>
        </div>
      </div>
      {status && status.emailEnabled && status.missing.length > 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">Falta configurar en el servidor: {status.missing.join(", ")}.</p>
      ) : null}
      {status && !status.paymentInstructionsConfigured ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Sin instrucciones de pago (CONTROL_CENTER_PAYMENT_INSTRUCTIONS): el correo pedirá comunicarse con MANUS.</p>
      ) : null}
      {notice ? <Toast variant="success" message={notice} onClose={() => setNotice(null)} /> : null}
      {error ? <Toast variant="error" message={error} /> : null}

      {testOpen ? (
        <Modal
          title="Enviar correo de prueba"
          description="Verifica la configuración SMTP sin tocar la cartera. Funciona aunque el canal de correo esté apagado."
          onClose={testing ? undefined : () => setTestOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setTestOpen(false)} disabled={testing}>Cancelar</Button>
              <Button onClick={() => void test()} isLoading={testing} disabled={!/^\S+@\S+\.\S+$/.test(testTo.trim())}>Enviar</Button>
            </div>
          }
        >
          <div className="space-y-3">
            <Input label="Correo de destino" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            {testError ? <Toast variant="error" message={testError} /> : null}
          </div>
        </Modal>
      ) : null}
    </section>
  );
};
