"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import { Toast } from "../../../components/design-system/Toast";
import { getPaymentCatalog, listAccounts, listCharges, registerReceipt } from "../api";
import { apiErrorMessage } from "../errors";
import {
  RECEIPT_ACCEPT,
  centsToMoney,
  formatCOP,
  formatDate,
  moneyToCents,
  newReceiptIdempotencyKey,
  normalizeMoneyInput,
  todayInBogota,
} from "../format";
import type { Charge, CommercialAccount, PaymentCatalog, ReceiptDetail } from "../types";

type Mode = "auto" | "manual" | "none";

type Props = {
  open: boolean;
  accountId?: string;
  onClose: () => void;
  onSaved: (receipt: ReceiptDetail) => void;
};

const MAX_MB = 5;

/** Registro manual de un pago con soporte opcional y aplicación automática, manual o como saldo a favor. */
export const RegisterPaymentDialog = ({ open, accountId: initialAccountId, onClose, onSaved }: Props) => {
  const [accounts, setAccounts] = useState<CommercialAccount[]>([]);
  const [catalog, setCatalog] = useState<PaymentCatalog>({ methods: [], institutions: [] });
  const [openCharges, setOpenCharges] = useState<Charge[]>([]);
  const [form, setForm] = useState({
    accountId: "",
    receivedOn: todayInBogota(),
    amount: "",
    paymentMethodId: "",
    financialInstitutionId: "",
    reference: "",
    notes: "",
  });
  const [mode, setMode] = useState<Mode>("auto");
  const [manual, setManual] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(newReceiptIdempotencyKey());

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFile(null);
    setManual({});
    setMode("auto");
    idempotencyKey.current = newReceiptIdempotencyKey();
    setForm({ accountId: initialAccountId ?? "", receivedOn: todayInBogota(), amount: "", paymentMethodId: "", financialInstitutionId: "", reference: "", notes: "" });
    void Promise.all([listAccounts({ limit: 50 }), getPaymentCatalog()])
      .then(([accountResult, catalogResult]) => {
        setAccounts(accountResult.items);
        setCatalog(catalogResult);
      })
      .catch((caught) => setError(apiErrorMessage(caught)));
  }, [open, initialAccountId]);

  useEffect(() => {
    if (!open || !form.accountId) {
      setOpenCharges([]);
      return;
    }
    void listCharges({ accountId: form.accountId, status: "OPEN,PARTIALLY_PAID", limit: 100 })
      .then((result) => setOpenCharges([...result.items].sort((a, b) => a.dueDate.localeCompare(b.dueDate))))
      .catch(() => setOpenCharges([]));
  }, [open, form.accountId]);

  const method = catalog.methods.find((m) => m.id === form.paymentMethodId) ?? null;
  const amount = normalizeMoneyInput(form.amount);
  const manualTotal = useMemo(
    () => Object.values(manual).reduce((sum, value) => sum + moneyToCents(normalizeMoneyInput(value) ?? "0"), BigInt(0)),
    [manual],
  );
  const manualInvalid = Object.entries(manual).some(([chargeId, value]) => {
    if (!value.trim()) return false;
    const normalized = normalizeMoneyInput(value);
    const charge = openCharges.find((c) => c.id === chargeId);
    return !normalized || !charge || moneyToCents(normalized) > moneyToCents(charge.balance);
  });
  const fileTooLarge = file ? file.size > MAX_MB * 1024 * 1024 : false;

  const problems: string[] = [];
  if (!form.accountId) problems.push("Selecciona la cuenta.");
  if (!amount || moneyToCents(amount) <= BigInt(0)) problems.push("Indica un valor mayor que cero.");
  if (!method) problems.push("Selecciona el medio de pago.");
  if (method?.requiresReference && !form.reference.trim()) problems.push(`${method.name} exige referencia.`);
  if (method?.requiresFinancialInstitution && !form.financialInstitutionId) problems.push(`${method.name} exige la entidad financiera.`);
  if (mode === "manual" && manualInvalid) problems.push("Revisa los valores aplicados: no pueden superar el saldo de cada cargo.");
  if (mode === "manual" && amount && manualTotal > moneyToCents(amount)) problems.push("Lo aplicado supera el valor del pago.");
  if (fileTooLarge) problems.push(`El soporte supera ${MAX_MB} MB.`);

  const submit = async () => {
    if (problems.length > 0 || !amount) return;
    setSaving(true);
    setError(null);
    try {
      const allocations =
        mode === "manual"
          ? Object.entries(manual)
              .map(([chargeId, value]) => ({ chargeId, amount: normalizeMoneyInput(value) ?? "" }))
              .filter((entry) => entry.amount && moneyToCents(entry.amount) > BigInt(0))
          : undefined;
      const receipt = await registerReceipt(
        {
          accountId: form.accountId,
          receivedOn: form.receivedOn,
          amount,
          paymentMethodId: form.paymentMethodId,
          financialInstitutionId: form.financialInstitutionId || undefined,
          reference: form.reference.trim() || undefined,
          notes: form.notes.trim() || undefined,
          autoAllocate: mode === "auto",
          allocations,
          attachment: file,
        },
        idempotencyKey.current,
      );
      onSaved(receipt);
      onClose();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      title="Registrar pago"
      description="El pago queda en la cartera del Control Center. Lo que no se aplique queda como saldo a favor de la cuenta."
      size="xl"
      onClose={saving ? undefined : onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void submit()} isLoading={saving} disabled={problems.length > 0}>Registrar pago</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Select label="Cuenta comercial" required value={form.accountId} onChange={(e) => { setForm({ ...form, accountId: e.target.value }); setManual({}); }}>
            <option value="">Selecciona…</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.legalName}</option>)}
          </Select>
          <Input label="Fecha del pago" type="date" required value={form.receivedOn} max={todayInBogota()} onChange={(e) => setForm({ ...form, receivedOn: e.target.value })} />
          <Input label="Valor recibido" inputMode="decimal" required placeholder="850.000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} hint={amount ? formatCOP(amount) : undefined} />
          <Select label="Medio de pago" required value={form.paymentMethodId} onChange={(e) => setForm({ ...form, paymentMethodId: e.target.value, financialInstitutionId: "" })} hint={catalog.methods.length === 0 ? "Configura los medios de pago del tenant plataforma en Finanzas." : undefined}>
            <option value="">Selecciona…</option>
            {catalog.methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          {method?.requiresFinancialInstitution ? (
            <Select label="Entidad financiera" required value={form.financialInstitutionId} onChange={(e) => setForm({ ...form, financialInstitutionId: e.target.value })}>
              <option value="">Selecciona…</option>
              {catalog.institutions.map((fi) => <option key={fi.id} value={fi.id}>{fi.name}</option>)}
            </Select>
          ) : null}
          <Input label={method?.requiresReference ? "Referencia (obligatoria)" : "Referencia"} maxLength={120} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">Soporte (PDF, JPG, PNG o WebP, máx. {MAX_MB} MB)</span>
            <input
              type="file"
              accept={RECEIPT_ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200 dark:text-slate-300 dark:file:bg-slate-700 dark:file:text-slate-100"
            />
          </label>
          <Textarea label="Notas" rows={2} maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">Aplicación del pago</legend>
          <div className="flex flex-wrap gap-4 text-sm text-slate-700 dark:text-slate-200">
            {([
              ["auto", "Automática (del cargo más antiguo al más nuevo)"],
              ["manual", "Elegir cargos"],
              ["none", "Dejar como saldo a favor"],
            ] as [Mode, string][]).map(([value, label]) => (
              <label key={value} className="inline-flex items-center gap-2">
                <input type="radio" name="allocation-mode" checked={mode === value} onChange={() => setMode(value)} />
                {label}
              </label>
            ))}
          </div>
          {form.accountId && openCharges.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">La cuenta no tiene cargos pendientes; el pago quedará como saldo a favor.</p>
          ) : null}
          {mode === "manual" && openCharges.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
                  <tr><th className="px-3 py-2">Cargo</th><th className="px-3 py-2">Contrato</th><th className="px-3 py-2">Vence</th><th className="px-3 py-2 text-right">Saldo</th><th className="px-3 py-2 text-right">Aplicar</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {openCharges.map((charge) => (
                    <tr key={charge.id}>
                      <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{charge.chargeNumber}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{charge.contractNumber}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatDate(charge.dueDate)}</td>
                      <td className="px-3 py-2 text-right text-slate-800 dark:text-slate-100">{formatCOP(charge.balance)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setManual({ ...manual, [charge.id]: charge.balance.split(".")[0] })}>Saldo</Button>
                          <input
                            aria-label={`Aplicar a ${charge.chargeNumber}`}
                            inputMode="decimal"
                            className="w-32 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                            value={manual[charge.id] ?? ""}
                            onChange={(e) => setManual({ ...manual, [charge.id]: e.target.value })}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-3 py-2 text-right text-xs text-slate-500 dark:text-slate-400">
                Aplicado {formatCOP(centsToMoney(manualTotal))}
                {amount ? ` · saldo a favor ${formatCOP(centsToMoney(moneyToCents(amount) - manualTotal > BigInt(0) ? moneyToCents(amount) - manualTotal : BigInt(0)))}` : ""}
              </p>
            </div>
          ) : null}
        </fieldset>

        {problems.length > 0 && (form.amount || form.paymentMethodId) ? (
          <ul className="list-disc pl-5 text-xs text-amber-700 dark:text-amber-300">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        ) : null}
        {error ? <Toast variant="error" message={error} /> : null}
      </div>
    </Modal>
  );
};
