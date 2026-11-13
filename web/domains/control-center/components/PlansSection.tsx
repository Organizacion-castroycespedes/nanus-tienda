"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, History, Plus, Tag } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import { Toast } from "../../../components/design-system/Toast";
import { createPlan, listPlans, listPlatformTaxes, listPriceVersions, publishPriceVersion, updatePlan } from "../api";
import { apiErrorMessage } from "../errors";
import { COMPONENT_LABELS, FREQUENCY_LABELS, formatCOP, formatDate, formatRate, normalizeMoneyInput } from "../format";
import type { BillingFrequency, Plan, PlatformTax, PriceComponentCode, PriceVersion } from "../types";
import { ControlCenterShell, useControlCenterAccess } from "./ControlCenterShell";
import { ReasonDialog } from "./ReasonDialog";
import { Pill } from "./StatusBadge";

const COMPONENT_ROWS: { component: PriceComponentCode; billingFrequency: BillingFrequency }[] = [
  { component: "BASE_INITIAL_TERM", billingFrequency: "ANNUAL" },
  { component: "BASE_INITIAL_TERM", billingFrequency: "MONTHLY" },
  { component: "BASE_RENEWAL", billingFrequency: "ANNUAL" },
  { component: "BASE_RENEWAL", billingFrequency: "MONTHLY" },
  { component: "EXTRA_POS_TERMINAL", billingFrequency: "ANNUAL" },
  { component: "EXTRA_POS_TERMINAL", billingFrequency: "MONTHLY" },
  { component: "CERTIFICATION", billingFrequency: "ANNUAL" },
];

const rowKey = (component: string, frequency: string) => `${component}:${frequency}`;

type VersionForm = {
  validFrom: string;
  taxId: string;
  pricesIncludeTax: boolean;
  includedPosTerminals: string;
  initialTermMonths: string;
  defaultTrialMonths: string;
  amounts: Record<string, string>;
};

export const PlansSection = () => {
  const { visible } = useControlCenterAccess();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [taxes, setTaxes] = useState<PlatformTax[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [planForm, setPlanForm] = useState({ code: "", name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [versionsOf, setVersionsOf] = useState<{ plan: Plan; versions: PriceVersion[] } | null>(null);
  const [publishing, setPublishing] = useState<Plan | null>(null);
  const [versionForm, setVersionForm] = useState<VersionForm | null>(null);
  const [retiring, setRetiring] = useState<Plan | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planResult, taxResult] = await Promise.all([listPlans(), listPlatformTaxes()]);
      setPlans(planResult.items);
      setTaxes(taxResult.items);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void load();
  }, [load, visible]);

  const openVersions = async (plan: Plan) => {
    try {
      setVersionsOf(await listPriceVersions(plan.id));
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  };

  const startPublish = async (plan: Plan) => {
    setFormError(null);
    let last: PriceVersion | undefined;
    try {
      last = (await listPriceVersions(plan.id)).versions[0];
    } catch {
      last = undefined;
    }
    const defaultTax = taxes.find((tax) => tax.rate.startsWith("0.19") && tax.isIncluded) ?? taxes[0];
    const amounts: Record<string, string> = {};
    for (const component of last?.components ?? []) {
      amounts[rowKey(component.component, component.billingFrequency)] = component.amount.replace(/\.00$/, "");
    }
    setVersionForm({
      validFrom: new Date().toISOString().slice(0, 10),
      taxId: last?.taxId ?? defaultTax?.id ?? "",
      pricesIncludeTax: last?.pricesIncludeTax ?? defaultTax?.isIncluded ?? true,
      includedPosTerminals: String(last?.includedPosTerminals ?? 1),
      initialTermMonths: String(last?.initialTermMonths ?? 12),
      defaultTrialMonths: String(last?.defaultTrialMonths ?? 1),
      amounts,
    });
    setPublishing(plan);
  };

  const versionPayload = useMemo(() => {
    if (!versionForm) return { components: [], invalid: [] as string[] };
    const invalid: string[] = [];
    const components = COMPONENT_ROWS.flatMap((row) => {
      const raw = versionForm.amounts[rowKey(row.component, row.billingFrequency)]?.trim() ?? "";
      if (!raw) return [];
      const amount = normalizeMoneyInput(raw);
      if (!amount) {
        invalid.push(`${COMPONENT_LABELS[row.component]} (${FREQUENCY_LABELS[row.billingFrequency]})`);
        return [];
      }
      return [{ ...row, amount }];
    });
    return { components, invalid };
  }, [versionForm]);

  const savePlan = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await createPlan({ code: planForm.code, name: planForm.name, description: planForm.description || undefined });
      setCreating(false);
      setPlanForm({ code: "", name: "", description: "" });
      await load();
    } catch (caught) {
      setFormError(apiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<Plan>[] = [
    {
      key: "plan",
      header: "Plan",
      render: (plan) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{plan.name}</p>
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{plan.code}</p>
        </div>
      ),
    },
    {
      key: "version",
      header: "Precio vigente",
      render: (plan) => (plan.currentVersionNo ? `Versión ${plan.currentVersionNo} desde ${formatDate(plan.currentValidFrom)}` : <Pill tone="warn">Sin precios</Pill>),
    },
    { key: "status", header: "Estado", render: (plan) => (plan.status === "ACTIVE" ? <Pill tone="ok">Activo</Pill> : <Pill tone="muted">Retirado</Pill>) },
    {
      key: "actions",
      header: "Acciones",
      render: (plan) => (
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={() => void openVersions(plan)}><History className="mr-1 h-4 w-4" aria-hidden /> Versiones</Button>
          {plan.status === "ACTIVE" ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => void startPublish(plan)}><Tag className="mr-1 h-4 w-4" aria-hidden /> Publicar precios</Button>
              <Button variant="ghost" size="sm" onClick={() => setRetiring(plan)}><Archive className="mr-1 h-4 w-4" aria-hidden /> Retirar</Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  const selectedTax = taxes.find((tax) => tax.id === versionForm?.taxId);

  return (
    <ControlCenterShell
      section="plans"
      description="Catálogo de planes y versiones de precio (los contratos firmados conservan su precio)"
      toolbar={
        <Button size="sm" onClick={() => { setCreating(true); setFormError(null); }}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Nuevo plan
        </Button>
      }
    >
      <div className="space-y-4">
        {error ? <Toast variant="error" message={error} /> : null}
        {taxes.length === 0 && !loading ? (
          <Toast variant="warning" message="El tenant plataforma no tiene impuestos activos; configúralos antes de publicar precios." />
        ) : null}
        <DataTable columns={columns} rows={plans} getRowKey={(plan) => plan.id} loading={loading} emptyState="Aún no hay planes." />
      </div>

      {creating ? (
        <Modal
          title="Nuevo plan"
          onClose={saving ? undefined : () => setCreating(false)}
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreating(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={() => void savePlan()} isLoading={saving}>Crear plan</Button>
            </div>
          }
        >
          <div className="grid gap-4">
            <Input label="Código" required placeholder="MANUS_POS_ANUAL" value={planForm.code} onChange={(e) => setPlanForm({ ...planForm, code: e.target.value })} hint="Mayúsculas, números y guion bajo. No se puede cambiar." />
            <Input label="Nombre" required value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} />
            <Textarea label="Descripción" rows={3} value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} />
            {formError ? <Toast variant="error" message={formError} /> : null}
          </div>
        </Modal>
      ) : null}

      {versionsOf ? (
        <Modal title={`Versiones de precio · ${versionsOf.plan.name}`} onClose={() => setVersionsOf(null)} size="xl">
          {versionsOf.versions.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Este plan aún no tiene precios publicados.</p>
          ) : (
            <div className="space-y-4">
              {versionsOf.versions.map((version) => (
                <section key={version.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Versión {version.versionNo}</h3>
                    {version.validTo ? <Pill tone="muted">{`${formatDate(version.validFrom)} – ${formatDate(version.validTo)}`}</Pill> : <Pill tone="ok">{`Vigente desde ${formatDate(version.validFrom)}`}</Pill>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {version.taxName} {formatRate(version.taxRate)} · {version.pricesIncludeTax ? "IVA incluido" : "IVA aparte"} · {version.includedPosTerminals} terminal(es) incluida(s) · prueba {version.defaultTrialMonths} mes(es) · término inicial {version.initialTermMonths} meses
                  </p>
                  <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                    {version.components.map((component) => (
                      <li key={rowKey(component.component, component.billingFrequency)} className="flex justify-between gap-2 border-b border-slate-100 py-1 dark:border-slate-700">
                        <span className="text-slate-600 dark:text-slate-300">{COMPONENT_LABELS[component.component]} · {FREQUENCY_LABELS[component.billingFrequency]}</span>
                        <span className="font-medium text-slate-900 dark:text-white">{formatCOP(component.amount)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">Motivo: {version.reason}</p>
                </section>
              ))}
            </div>
          )}
        </Modal>
      ) : null}

      <ReasonDialog
        open={publishing !== null && versionForm !== null}
        title={publishing ? `Publicar precios · ${publishing.name}` : "Publicar precios"}
        description="La versión anterior se cierra el día antes de la nueva vigencia. Los contratos existentes no cambian."
        confirmText="Publicar versión"
        canConfirm={Boolean(versionForm?.taxId) && versionPayload.invalid.length === 0 && versionPayload.components.some((c) => c.component === "BASE_INITIAL_TERM")}
        onClose={() => { setPublishing(null); setVersionForm(null); }}
        onConfirm={async (reason) => {
          if (!publishing || !versionForm) return;
          await publishPriceVersion(publishing.id, {
            validFrom: versionForm.validFrom,
            taxId: versionForm.taxId,
            pricesIncludeTax: versionForm.pricesIncludeTax,
            includedPosTerminals: Number(versionForm.includedPosTerminals),
            initialTermMonths: Number(versionForm.initialTermMonths),
            defaultTrialMonths: Number(versionForm.defaultTrialMonths),
            components: versionPayload.components,
            reason,
          });
          await load();
        }}
      >
        {versionForm ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Vigente desde" type="date" required value={versionForm.validFrom} onChange={(e) => setVersionForm({ ...versionForm, validFrom: e.target.value })} />
              <Select
                label="Impuesto (tenant plataforma)"
                value={versionForm.taxId}
                onChange={(e) => {
                  const tax = taxes.find((t) => t.id === e.target.value);
                  setVersionForm({ ...versionForm, taxId: e.target.value, pricesIncludeTax: tax?.isIncluded ?? versionForm.pricesIncludeTax });
                }}
              >
                {taxes.map((tax) => (
                  <option key={tax.id} value={tax.id}>{tax.name} ({formatRate(tax.rate)})</option>
                ))}
              </Select>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={versionForm.pricesIncludeTax} onChange={(e) => setVersionForm({ ...versionForm, pricesIncludeTax: e.target.checked })} />
                Precios con {selectedTax?.name ?? "impuesto"} incluido
              </label>
              <Input label="Terminales POS incluidas" type="number" min={0} value={versionForm.includedPosTerminals} onChange={(e) => setVersionForm({ ...versionForm, includedPosTerminals: e.target.value })} />
              <Input label="Término inicial (meses)" type="number" min={1} max={60} value={versionForm.initialTermMonths} onChange={(e) => setVersionForm({ ...versionForm, initialTermMonths: e.target.value })} />
              <Input label="Prueba por defecto (meses)" type="number" min={0} max={12} value={versionForm.defaultTrialMonths} onChange={(e) => setVersionForm({ ...versionForm, defaultTrialMonths: e.target.value })} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Componentes de precio (deja vacío lo que no aplique)</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {COMPONENT_ROWS.map((row) => {
                  const key = rowKey(row.component, row.billingFrequency);
                  return (
                    <Input
                      key={key}
                      label={`${COMPONENT_LABELS[row.component]} · ${FREQUENCY_LABELS[row.billingFrequency]}`}
                      inputMode="numeric"
                      placeholder="$ 0"
                      value={versionForm.amounts[key] ?? ""}
                      onChange={(e) => setVersionForm({ ...versionForm, amounts: { ...versionForm.amounts, [key]: e.target.value } })}
                    />
                  );
                })}
              </div>
              {versionPayload.invalid.length > 0 ? (
                <p className="mt-2 text-xs text-rose-600">Montos inválidos: {versionPayload.invalid.join(", ")}</p>
              ) : null}
              {!versionPayload.components.some((c) => c.component === "BASE_INITIAL_TERM") ? (
                <p className="mt-2 text-xs text-amber-600">Define al menos el precio del término inicial.</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </ReasonDialog>

      <ReasonDialog
        open={retiring !== null}
        title="Retirar plan"
        description={retiring ? `${retiring.name} no se podrá usar en contratos nuevos. Los contratos existentes se conservan.` : undefined}
        confirmText="Retirar plan"
        variant="danger"
        onClose={() => setRetiring(null)}
        onConfirm={async (reason) => {
          if (!retiring) return;
          await updatePlan(retiring.id, { status: "RETIRED", reason });
          await load();
        }}
      />
    </ControlCenterShell>
  );
};
