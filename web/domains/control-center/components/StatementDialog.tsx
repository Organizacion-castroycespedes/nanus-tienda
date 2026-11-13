"use client";

import { useEffect, useState } from "react";
import { FileDown, Mail } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { Select } from "../../../components/design-system/Select";
import { Toast } from "../../../components/design-system/Toast";
import { downloadAccountStatement, listAccounts, sendAccountStatement } from "../api";
import { apiErrorMessage } from "../errors";
import { defaultStatementFrom, saveBlob, todayInBogota } from "../format";
import type { CommercialAccount } from "../types";

type Props = { open: boolean; accountId?: string; accountName?: string; onClose: () => void };

/** Estado de cuenta en PDF: rango de fechas, descarga y envío al correo de facturación. */
export const StatementDialog = ({ open, accountId: initialAccountId, accountName, onClose }: Props) => {
  const [accounts, setAccounts] = useState<CommercialAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [busy, setBusy] = useState<"download" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const to = todayInBogota();
    setRange({ from: defaultStatementFrom(to), to });
    setAccountId(initialAccountId ?? "");
    setError(null);
    setNotice(null);
    if (!initialAccountId) {
      void listAccounts({ limit: 50 }).then((result) => setAccounts(result.items)).catch((caught) => setError(apiErrorMessage(caught)));
    }
  }, [open, initialAccountId]);

  if (!open) return null;
  const valid = Boolean(accountId && range.from && range.to && range.from <= range.to);
  const selectedName = accountName ?? accounts.find((a) => a.id === accountId)?.legalName ?? "cliente";

  const download = async () => {
    setBusy("download");
    setError(null);
    setNotice(null);
    try {
      saveBlob(await downloadAccountStatement(accountId, range), `estado-cuenta-${range.from}-${range.to}.pdf`);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    setBusy("send");
    setError(null);
    setNotice(null);
    try {
      const result = await sendAccountStatement(accountId, range);
      setNotice(`Estado de cuenta enviado a ${result.to}.`);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      title="Estado de cuenta"
      description={`Cargos que vencen en el período y todo lo pendiente, pagos del período, saldo y mora de ${selectedName}.`}
      onClose={busy ? undefined : onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy !== null}>Cerrar</Button>
          <Button variant="secondary" onClick={() => void send()} isLoading={busy === "send"} disabled={!valid || busy !== null}>
            <Mail className="mr-1 h-4 w-4" aria-hidden /> Enviar por correo
          </Button>
          <Button onClick={() => void download()} isLoading={busy === "download"} disabled={!valid || busy !== null}>
            <FileDown className="mr-1 h-4 w-4" aria-hidden /> Descargar PDF
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {!initialAccountId ? (
          <Select label="Cuenta comercial" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Selecciona…</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.legalName}</option>)}
          </Select>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Desde" type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          <Input label="Hasta (fecha de corte del período)" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">El correo se envía al email de facturación de la cuenta con el PDF adjunto. Máximo 36 meses.</p>
        {notice ? <Toast variant="success" message={notice} /> : null}
        {error ? <Toast variant="error" message={error} /> : null}
      </div>
    </Modal>
  );
};
