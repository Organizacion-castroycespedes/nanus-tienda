"use client";

import { useEffect, useState } from "react";
import { BellRing, Mail, MessageCircle } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { Toast } from "../../../components/design-system/Toast";
import { getAlertsStatus, runAlerts, sendTestEmail, sendTestWhatsapp } from "../api";
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
  const [testChannel, setTestChannel] = useState<"EMAIL" | "WHATSAPP">("EMAIL");

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
          : `Alertas: ${result.chargesEvaluated} cargo(s) evaluados, ${result.noticesPublished} aviso(s) publicados, ${result.noticesResolved} resueltos. Correo: ${result.emailsSent} enviados, ${result.emailsFailed} fallidos, ${result.emailsSkipped} omitidos. WhatsApp: ${result.whatsappSent} enviados, ${result.whatsappFailed} fallidos, ${result.whatsappSkipped} omitidos.`,
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
      const result = testChannel === "EMAIL" ? await sendTestEmail(testTo.trim()) : await sendTestWhatsapp(testTo.trim());
      setNotice(`${testChannel === "EMAIL" ? "Correo" : "WhatsApp"} de prueba enviado a ${result.to}.`);
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
              <Pill tone={status.whatsappReady ? "ok" : status.whatsappEnabled ? "warn" : "muted"}>
                {status.whatsappReady ? "WhatsApp activo" : status.whatsappEnabled ? "WhatsApp sin configurar" : "WhatsApp apagado"}
              </Pill>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => void run()} isLoading={running}>
            <BellRing className="mr-1 h-4 w-4" aria-hidden /> Ejecutar alertas
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setTestChannel("EMAIL"); setTestTo(""); setTestOpen(true); setTestError(null); }}>
            <Mail className="mr-1 h-4 w-4" aria-hidden /> Correo de prueba
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setTestChannel("WHATSAPP"); setTestTo("+57"); setTestOpen(true); setTestError(null); }}>
            <MessageCircle className="mr-1 h-4 w-4" aria-hidden /> WhatsApp de prueba
          </Button>
        </div>
      </div>
      {status && status.emailEnabled && status.missing.length > 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">Falta configurar en el servidor: {status.missing.join(", ")}.</p>
      ) : null}
      {status && status.whatsappEnabled && status.whatsappMissing.length > 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">WhatsApp: falta configurar {status.whatsappMissing.join(", ")}.</p>
      ) : null}
      {status && !status.paymentInstructionsConfigured ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Sin instrucciones de pago (CONTROL_CENTER_PAYMENT_INSTRUCTIONS): el correo pedirá comunicarse con MANUS.</p>
      ) : null}
      {notice ? <Toast variant="success" message={notice} onClose={() => setNotice(null)} /> : null}
      {error ? <Toast variant="error" message={error} /> : null}

      {testOpen ? (
        <Modal
          title={testChannel === "EMAIL" ? "Enviar correo de prueba" : "Enviar WhatsApp de prueba"}
          description={
            testChannel === "EMAIL"
              ? "Verifica la configuración SMTP sin tocar la cartera. Funciona aunque el canal de correo esté apagado."
              : "Envía la plantilla de muestra hello_world de Meta. Requiere el número y el token configurados; el número de destino debe estar habilitado en tu cuenta de prueba de Meta."
          }
          onClose={testing ? undefined : () => setTestOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setTestOpen(false)} disabled={testing}>Cancelar</Button>
              <Button
                onClick={() => void test()}
                isLoading={testing}
                disabled={testChannel === "EMAIL" ? !/^\S+@\S+\.\S+$/.test(testTo.trim()) : !/^\+[1-9]\d{7,14}$/.test(testTo.trim())}
              >
                Enviar
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <Input
              label={testChannel === "EMAIL" ? "Correo de destino" : "Celular de destino (E.164, por ejemplo +573001234567)"}
              type={testChannel === "EMAIL" ? "email" : "tel"}
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
            {testError ? <Toast variant="error" message={testError} /> : null}
          </div>
        </Modal>
      ) : null}
    </section>
  );
};
