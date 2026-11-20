"use client";

import { useEffect, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import { formatQuotationDate, formatQuotationMoney } from "../quotation-format";

export const QuotationRejectDialog = ({
  code,
  busy,
  onCancel,
  onConfirm,
}: {
  code: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) => {
  const [reason, setReason] = useState("");
  return (
    <Modal
      title={`Rechazar ${code}`}
      description="El motivo queda registrado en la cotización."
      size="md"
      onClose={busy ? undefined : onCancel}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => onConfirm(reason.trim())} disabled={busy || !reason.trim()} isLoading={busy}>
            Rechazar
          </Button>
        </div>
      }
    >
      <Textarea
        label="Motivo del rechazo"
        rows={4}
        maxLength={1000}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Ej.: El cliente eligió otro proveedor."
      />
    </Modal>
  );
};

export const QuotationConvertDialog = ({
  code,
  total,
  validUntil,
  customerName,
  busy,
  onCancel,
  onConfirm,
}: {
  code: string;
  total: number;
  validUntil: string;
  customerName: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (type: "CASH" | "CREDIT") => void;
}) => {
  const [type, setType] = useState<"CASH" | "CREDIT">("CASH");
  return (
    <Modal
      title={`Convertir ${code} en pedido`}
      description="Se crea un único pedido en borrador con los precios cotizados. La cotización queda convertida y no se puede volver a convertir."
      size="md"
      onClose={busy ? undefined : onCancel}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(type)} disabled={busy} isLoading={busy}>
            Crear pedido
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
          <dt className="text-slate-500 dark:text-slate-400">Cliente</dt>
          <dd className="text-right font-medium text-slate-900 dark:text-white">{customerName ?? "-"}</dd>
          <dt className="text-slate-500 dark:text-slate-400">Total cotizado</dt>
          <dd className="text-right font-semibold text-slate-900 dark:text-white">{formatQuotationMoney(total)}</dd>
          <dt className="text-slate-500 dark:text-slate-400">Vigente hasta</dt>
          <dd className="text-right text-slate-900 dark:text-white">{formatQuotationDate(validUntil)}</dd>
        </dl>
        <Select label="Tipo de pedido" value={type} onChange={(event) => setType(event.target.value as "CASH" | "CREDIT")}>
          <option value="CASH">Contado</option>
          <option value="CREDIT">Crédito</option>
        </Select>
      </div>
    </Modal>
  );
};

export const QuotationSettingsDialog = ({
  initialDays,
  busy,
  onCancel,
  onSave,
}: {
  initialDays: number;
  busy: boolean;
  onCancel: () => void;
  onSave: (days: number) => void;
}) => {
  const [days, setDays] = useState(String(initialDays));
  useEffect(() => setDays(String(initialDays)), [initialDays]);
  const value = Number(days);
  const valid = Number.isInteger(value) && value >= 1 && value <= 365;
  return (
    <Modal
      title="Vigencia de cotizaciones"
      description="Días de vigencia que se aplican a las cotizaciones nuevas y renovadas. No cambia las existentes."
      size="md"
      onClose={busy ? undefined : onCancel}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(value)} disabled={busy || !valid} isLoading={busy}>
            Guardar
          </Button>
        </div>
      }
    >
      <Input
        label="Días de vigencia"
        type="number"
        min={1}
        max={365}
        step={1}
        value={days}
        onWheel={(event) => event.currentTarget.blur()}
        onChange={(event) => setDays(event.target.value)}
        hint="Entre 1 y 365 días. Por defecto 15."
      />
    </Modal>
  );
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Confirma el destinatario (correo del cliente o uno nuevo) y un mensaje opcional; el PDF va adjunto. */
export const QuotationEmailDialog = ({
  code,
  customerName,
  customerEmail,
  busy,
  onCancel,
  onConfirm,
}: {
  code: string;
  customerName: string | null;
  customerEmail: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (payload: { to?: string; message?: string }) => void;
}) => {
  const hasCustomerEmail = Boolean(customerEmail && EMAIL_PATTERN.test(customerEmail.trim()));
  const [target, setTarget] = useState<"customer" | "other">(hasCustomerEmail ? "customer" : "other");
  const [otherEmail, setOtherEmail] = useState("");
  const [message, setMessage] = useState("");
  const destination = target === "customer" ? (customerEmail ?? "").trim() : otherEmail.trim();
  const valid = EMAIL_PATTERN.test(destination);

  return (
    <Modal
      title={`Enviar ${code} por correo`}
      description="Se adjunta el PDF de la cotización. El archivo se genera al momento y no se guarda en el servidor."
      size="md"
      onClose={busy ? undefined : onCancel}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onConfirm({
                ...(target === "other" ? { to: destination } : {}),
                ...(message.trim() ? { message: message.trim() } : {}),
              })
            }
            disabled={busy || !valid}
            isLoading={busy}
          >
            Enviar correo
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">Destinatario</legend>
          <label
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${hasCustomerEmail ? "cursor-pointer border-slate-200 dark:border-slate-700" : "cursor-not-allowed border-dashed border-slate-200 opacity-60 dark:border-slate-700"}`}
          >
            <input
              type="radio"
              name="quotation-email-target"
              className="mt-1"
              checked={target === "customer"}
              disabled={!hasCustomerEmail}
              onChange={() => setTarget("customer")}
            />
            <span>
              <span className="block font-medium text-slate-900 dark:text-white">Correo del cliente</span>
              <span className="block text-slate-600 dark:text-slate-400">
                {hasCustomerEmail ? `${customerName ?? "Cliente"} · ${customerEmail}` : "El cliente no tiene un correo válido registrado."}
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700">
            <input
              type="radio"
              name="quotation-email-target"
              className="mt-1"
              checked={target === "other"}
              onChange={() => setTarget("other")}
            />
            <span className="flex-1">
              <span className="block font-medium text-slate-900 dark:text-white">Otro correo</span>
              <input
                type="email"
                value={otherEmail}
                maxLength={254}
                placeholder="nombre@empresa.com"
                onFocus={() => setTarget("other")}
                onChange={(event) => setOtherEmail(event.target.value)}
                aria-invalid={target === "other" && otherEmail.trim().length > 0 && !valid}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </span>
          </label>
        </fieldset>
        <Textarea
          label="Mensaje (opcional)"
          rows={3}
          maxLength={2000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ej.: Quedamos atentos a sus comentarios."
        />
      </div>
    </Modal>
  );
};
