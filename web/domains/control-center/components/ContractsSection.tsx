"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilePlus2, Plus, Trash2 } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { Pagination } from "../../../components/design-system/Pagination";
import { SearchFilters } from "../../../components/design-system/SearchFilters";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import { Toast } from "../../../components/design-system/Toast";
import { createContract, getAccount, listAccounts, listContracts, listPlans, previewContract } from "../api";
import { apiErrorMessage } from "../errors";
import {
  BILLING_FREQUENCY_OPTIONS,
  FREQUENCY_LABELS,
  MIN_REASON_LENGTH,
  TERM_PHASE_LABELS,
  formatDate,
  isValidReason,
  newIdempotencyKey,
  normalizeMoneyInput,
} from "../format";
import type {
  AccountTenantLink,
  BillingFrequency,
  CommercialAccount,
  ContractDraftInput,
  ContractListItem,
  ContractPreview,
  ItemFrequency,
  Plan,
} from "../types";
import { ContractItemsTable, TotalsSummary } from "./ContractItemsTable";
import { ControlCenterShell, useControlCenterAccess, useControlCenterHref } from "./ControlCenterShell";
import { ContractStatusBadge } from "./StatusBadge";

type CustomRow = { description: string; quantity: string; unitAmount: string; billingFrequency: ItemFrequency };

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Borrador" },
  { value: "active", label: "Activo" },
  { value: "ended", label: "Terminado" },
  { value: "cancelled", label: "Cancelado" },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

export const ContractsSection = () => {
  const { visible } = useControlCenterAccess();
  const href = useControlCenterHref();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<{ items: ContractListItem[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [accounts, setAccounts] = useState<CommercialAccount[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tenantLinks, setTenantLinks] = useState<AccountTenantLink[]>([]);
  const [draft, setDraft] = useState({
    accountId: "",
    tenantId: "",
    planId: "",
    startDate: todayIso(),
    billingFrequency: "ANNUAL" as BillingFrequency,
    extraPosTerminals: "0",
    trialMonths: "",
    prorationPolicy: "DAILY" as "NONE" | "DAILY",
  });
  const [customRows, setCustomRows] = useState<CustomRow[]>([]);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<ContractPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const idempotencyKey = useRef<string>(newIdempotencyKey());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listContracts({
        search: search.trim(),
        status: status === "all" ? undefined : status.toUpperCase(),
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setData({ items: result.items, total: result.total });
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load, visible]);

  const openWizard = async () => {
    setWizardOpen(true);
    setPreview(null);
    setPreviewError(null);
    setSaveError(null);
    setReason("");
    setCustomRows([]);
    idempotencyKey.current = newIdempotencyKey();
    try {
      const [accountResult, planResult] = await Promise.all([listAccounts({ status: "ACTIVE", limit: 50 }), listPlans()]);
      setAccounts(accountResult.items);
      setPlans(planResult.items.filter((plan) => plan.status === "ACTIVE" && plan.currentVersionId));
    } catch (caught) {
      setSaveError(apiErrorMessage(caught));
    }
  };

  useEffect(() => {
    if (!draft.accountId) {
      setTenantLinks([]);
      return;
    }
    void getAccount(draft.accountId)
      .then((account) => setTenantLinks(account.tenants.filter((link) => link.status === "ACTIVE")))
      .catch(() => setTenantLinks([]));
  }, [draft.accountId]);

  const customValidation = useMemo(() => {
    const items = customRows.map((row) => ({
      description: row.description.trim(),
      quantity: row.quantity.trim() || "1",
      unitAmount: normalizeMoneyInput(row.unitAmount) ?? "",
      billingFrequency: row.billingFrequency,
      discountAmount: "0",
    }));
    const valid = items.every((item) => item.description && item.unitAmount);
    return { items, valid };
  }, [customRows]);

  const payload: ContractDraftInput | null = useMemo(() => {
    if (!draft.accountId || !draft.tenantId || !draft.planId || !draft.startDate || !customValidation.valid) return null;
    return {
      accountId: draft.accountId,
      tenantId: draft.tenantId,
      planId: draft.planId,
      startDate: draft.startDate,
      billingFrequency: draft.billingFrequency,
      extraPosTerminals: Number(draft.extraPosTerminals || 0),
      prorationPolicy: draft.prorationPolicy,
      trialMonths: draft.trialMonths === "" ? null : Number(draft.trialMonths),
      customItems: customValidation.items,
    };
  }, [customValidation, draft]);

  useEffect(() => {
    if (!wizardOpen || !payload) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setPreviewError(null);
        setPreview(await previewContract(payload));
      } catch (caught) {
        setPreview(null);
        setPreviewError(apiErrorMessage(caught));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [payload, wizardOpen]);

  const plan = plans.find((p) => p.id === draft.planId);
  const needsReason = draft.trialMonths !== "" || (preview?.priceAdjusted ?? false);

  const save = async () => {
    if (!payload) return;
    if (needsReason && !isValidReason(reason)) {
      setSaveError(`Indica un motivo de al menos ${MIN_REASON_LENGTH} caracteres (cambiaste la prueba o los precios).`);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const created = await createContract({ ...payload, reason: reason.trim() || undefined }, idempotencyKey.current);
      setWizardOpen(false);
      router.push(href(`contracts/${created.id}`));
    } catch (caught) {
      setSaveError(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<ContractListItem>[] = [
    {
      key: "number",
      header: "Contrato",
      render: (row) => (
        <Link href={href(`contracts/${row.id}`)} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
          {row.contractNumber}
        </Link>
      ),
    },
    {
      key: "client",
      header: "Cliente / tenant",
      render: (row) => (
        <div>
          <p className="text-slate-900 dark:text-white">{row.accountLegalName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{row.tenantName ?? row.tenantSlug}</p>
        </div>
      ),
    },
    { key: "plan", header: "Plan", render: (row) => row.planName },
    {
      key: "terms",
      header: "Condiciones",
      render: (row) =>
        row.termPhase && row.billingFrequency ? `${TERM_PHASE_LABELS[row.termPhase]} · ${FREQUENCY_LABELS[row.billingFrequency]}` : "—",
    },
    { key: "start", header: "Inicio", render: (row) => formatDate(row.startDate) },
    { key: "status", header: "Estado", render: (row) => <ContractStatusBadge status={row.status} /> },
  ];

  return (
    <ControlCenterShell
      section="contracts"
      description="Contratos por tenant con precios congelados al firmar"
      toolbar={
        <Button size="sm" onClick={() => void openWizard()}>
          <FilePlus2 className="mr-2 h-4 w-4" aria-hidden />
          Nuevo contrato
        </Button>
      }
    >
      <div className="space-y-4">
        <SearchFilters
          query={search}
          status={status}
          statusOptions={STATUS_OPTIONS}
          onQueryChange={(value) => { setSearch(value); setPage(1); }}
          onStatusChange={(value) => { setStatus(value); setPage(1); }}
          queryPlaceholder="Número, cliente o tenant"
        />
        {error ? <Toast variant="error" message={error} /> : null}
        <DataTable columns={columns} rows={data.items} getRowKey={(row) => row.id} loading={loading} emptyState="Aún no hay contratos." />
        <Pagination page={page} pageSize={pageSize} totalItems={data.total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} loading={loading} />
      </div>

      {wizardOpen ? (
        <Modal
          title="Nuevo contrato"
          description="Se crea en borrador con los precios vigentes del plan. Actívalo desde su ficha."
          onClose={saving ? undefined : () => setWizardOpen(false)}
          size="full"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setWizardOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={() => void save()} isLoading={saving} disabled={!payload || !preview}>Crear borrador</Button>
            </div>
          }
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="space-y-4">
              <Select label="Cuenta comercial" required value={draft.accountId} onChange={(e) => setDraft({ ...draft, accountId: e.target.value, tenantId: "" })}>
                <option value="">Selecciona…</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.legalName} · {account.taxId}</option>
                ))}
              </Select>
              <Select label="Tenant vinculado" required value={draft.tenantId} disabled={!draft.accountId} onChange={(e) => setDraft({ ...draft, tenantId: e.target.value })}>
                <option value="">{draft.accountId && tenantLinks.length === 0 ? "La cuenta no tiene tenants vinculados" : "Selecciona…"}</option>
                {tenantLinks.map((link) => (
                  <option key={link.tenantId} value={link.tenantId}>{link.tenantName ?? link.tenantSlug}</option>
                ))}
              </Select>
              <Select label="Plan" required value={draft.planId} onChange={(e) => setDraft({ ...draft, planId: e.target.value })}>
                <option value="">Selecciona…</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} (versión {p.currentVersionNo})</option>
                ))}
              </Select>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Fecha de inicio" type="date" required value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
                <Select label="Frecuencia de cobro" value={draft.billingFrequency} onChange={(e) => setDraft({ ...draft, billingFrequency: e.target.value as BillingFrequency })}>
                  {BILLING_FREQUENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
                <Input label="Terminales POS adicionales" type="number" min={0} value={draft.extraPosTerminals} onChange={(e) => setDraft({ ...draft, extraPosTerminals: e.target.value })} />
                <Input
                  label="Meses de prueba"
                  type="number"
                  min={0}
                  max={12}
                  placeholder="Por defecto del plan"
                  value={draft.trialMonths}
                  onChange={(e) => setDraft({ ...draft, trialMonths: e.target.value })}
                  hint="Vacío = valor del plan. Cambiarlo exige motivo."
                />
                <Select label="Prorrateo" value={draft.prorationPolicy} onChange={(e) => setDraft({ ...draft, prorationPolicy: e.target.value as "NONE" | "DAILY" })}>
                  <option value="DAILY">Diario</option>
                  <option value="NONE">Sin prorrateo</option>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Ítems adicionales (sede, capacitación, etc.)</p>
                  <Button variant="ghost" size="sm" onClick={() => setCustomRows([...customRows, { description: "", quantity: "1", unitAmount: "", billingFrequency: "ONE_TIME" }])}>
                    <Plus className="mr-1 h-4 w-4" aria-hidden /> Agregar
                  </Button>
                </div>
                {customRows.map((row, index) => (
                  <div key={index} className="grid grid-cols-[1fr_70px_120px_110px_auto] items-end gap-2">
                    <Input label="Concepto" value={row.description} onChange={(e) => setCustomRows(customRows.map((r, i) => (i === index ? { ...r, description: e.target.value } : r)))} />
                    <Input label="Cant." value={row.quantity} onChange={(e) => setCustomRows(customRows.map((r, i) => (i === index ? { ...r, quantity: e.target.value } : r)))} />
                    <Input label="Valor" inputMode="numeric" value={row.unitAmount} onChange={(e) => setCustomRows(customRows.map((r, i) => (i === index ? { ...r, unitAmount: e.target.value } : r)))} />
                    <Select label="Frecuencia" value={row.billingFrequency} onChange={(e) => setCustomRows(customRows.map((r, i) => (i === index ? { ...r, billingFrequency: e.target.value as ItemFrequency } : r)))}>
                      <option value="ONE_TIME">Único</option>
                      <option value="MONTHLY">Mensual</option>
                      <option value="ANNUAL">Anual</option>
                    </Select>
                    <Button variant="ghost" size="sm" aria-label="Quitar ítem" onClick={() => setCustomRows(customRows.filter((_, i) => i !== index))}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                ))}
              </div>
              <Textarea
                label={needsReason ? "Motivo (obligatorio)" : "Motivo (opcional)"}
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                hint={needsReason ? `Cambiaste la prueba o los precios: mínimo ${MIN_REASON_LENGTH} caracteres.` : undefined}
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Vista previa{plan ? ` · ${plan.name}` : ""}</h3>
              {!payload ? <p className="text-sm text-slate-500 dark:text-slate-400">Completa cuenta, tenant, plan y fecha para ver los ítems.</p> : null}
              {previewError ? <Toast variant="error" message={previewError} /> : null}
              {preview ? (
                <>
                  <div className="grid gap-2 text-sm sm:grid-cols-3">
                    <p className="text-slate-600 dark:text-slate-300">Día de corte: <span className="font-semibold">{preview.billingAnchorDay}</span></p>
                    <p className="text-slate-600 dark:text-slate-300">Prueba hasta: <span className="font-semibold">{formatDate(preview.trialEndsOn)}</span></p>
                    <p className="text-slate-600 dark:text-slate-300">Terminales contratadas: <span className="font-semibold">{preview.contractedPosTerminals}</span></p>
                  </div>
                  <ContractItemsTable items={preview.items} />
                  <TotalsSummary totals={preview.totals} taxName={preview.tax.name} taxRate={preview.tax.rate} pricesIncludeTax={preview.tax.pricesIncludeTax} />
                </>
              ) : null}
              {saveError ? <Toast variant="error" message={saveError} /> : null}
            </div>
          </div>
        </Modal>
      ) : null}
    </ControlCenterShell>
  );
};
