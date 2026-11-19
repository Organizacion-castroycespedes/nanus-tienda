"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Ban, CheckCircle2, FileDown, FilePen, Flag, XCircle } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { ReportSummary } from "../../../components/design-system/ReportSummary";
import { Select } from "../../../components/design-system/Select";
import { Toast } from "../../../components/design-system/Toast";
import { activateContract, amendContract, cancelContract, downloadContractPdf, endContract, getContract, voidContract } from "../api";
import { apiErrorMessage } from "../errors";
import {
  AUDIT_ACTION_LABELS,
  BILLING_FREQUENCY_OPTIONS,
  FREQUENCY_LABELS,
  TERM_PHASE_LABELS,
  formatDate,
  formatRate,
} from "../format";
import type { BillingFrequency, ContractDetail, TermPhase } from "../types";
import { ContractChargesPanel } from "./ContractChargesPanel";
import { ContractItemsTable, TotalsSummary } from "./ContractItemsTable";
import { ControlCenterShell, useControlCenterAccess, useControlCenterHref } from "./ControlCenterShell";
import { ReasonDialog } from "./ReasonDialog";
import { ContractStatusBadge, Pill } from "./StatusBadge";

type Action = "activate" | "cancel" | "amend" | "end" | "void" | null;

const addYear = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return `${y + 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

export const ContractDetailView = ({ contractId }: { contractId: string }) => {
  const { visible } = useControlCenterAccess();
  const href = useControlCenterHref();
  const router = useRouter();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [amend, setAmend] = useState({ effectiveFrom: "", termPhase: "RENEWAL" as TermPhase, billingFrequency: "MONTHLY" as BillingFrequency, extraPosTerminals: "0" });
  const [endDate, setEndDate] = useState("");

  const load = useCallback(async () => {
    try {
      setError(null);
      setContract(await getContract(contractId));
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }, [contractId]);

  useEffect(() => {
    if (visible) void load();
  }, [load, visible]);

  const [downloading, setDownloading] = useState<string | null>(null);

  const downloadPdf = async (versionId?: string) => {
    if (!contract) return;
    setDownloading(versionId ?? "current");
    setError(null);
    try {
      const blob = await downloadContractPdf(contract.id, versionId);
      const version = contract.versions.find((v) => v.id === (versionId ?? contract.currentVersionId)) ?? contract.versions[0];
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${contract.contractNumber}-v${version?.versionNo ?? ""}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setDownloading(null);
    }
  };

  const current = contract?.versions.find((version) => version.id === contract.currentVersionId) ?? contract?.versions[0];

  const openAmend = () => {
    if (!current) return;
    const extras = current.items.filter((item) => item.itemType === "EXTRA_POS_TERMINAL").reduce((sum, item) => sum + Number(item.quantity), 0);
    setAmend({ effectiveFrom: addYear(current.effectiveFrom), termPhase: "RENEWAL", billingFrequency: current.billingFrequency, extraPosTerminals: String(extras) });
    setAction("amend");
  };

  return (
    <ControlCenterShell
      section="contracts"
      description={contract ? `Contrato ${contract.contractNumber}` : "Detalle del contrato"}
      toolbar={
        <>
          <Button variant="ghost" size="sm" onClick={() => router.push(href("contracts"))}>
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> Contratos
          </Button>
          {contract ? (
            <Button variant="secondary" size="sm" onClick={() => void downloadPdf()} isLoading={downloading === "current"}>
              <FileDown className="mr-1 h-4 w-4" aria-hidden /> Descargar PDF
            </Button>
          ) : null}
          {contract?.status === "DRAFT" ? (
            <>
              <Button size="sm" onClick={() => setAction("activate")}><CheckCircle2 className="mr-1 h-4 w-4" aria-hidden /> Activar</Button>
              <Button size="sm" variant="ghost" onClick={() => setAction("cancel")}><XCircle className="mr-1 h-4 w-4" aria-hidden /> Cancelar</Button>
            </>
          ) : null}
          {contract?.status === "ACTIVE" ? (
            <>
              <Button size="sm" onClick={openAmend}><FilePen className="mr-1 h-4 w-4" aria-hidden /> Enmendar / renovar</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEndDate(""); setAction("end"); }}><Flag className="mr-1 h-4 w-4" aria-hidden /> Terminar</Button>
              <Button size="sm" variant="ghost" onClick={() => setAction("void")}><Ban className="mr-1 h-4 w-4" aria-hidden /> Anular</Button>
            </>
          ) : null}
        </>
      }
      summary={
        contract && current ? (
          <ReportSummary
            items={[
              { label: "Estado", value: <ContractStatusBadge status={contract.status} /> },
              { label: "Condición vigente", value: `${TERM_PHASE_LABELS[current.termPhase]} · ${FREQUENCY_LABELS[current.billingFrequency]}` },
              { label: "Terminales POS", value: `${contract.activePosTerminals} activas / ${current.contractedPosTerminals} contratadas` },
              { label: "Día de corte", value: current.billingAnchorDay },
            ]}
          />
        ) : null
      }
    >
      {error ? <Toast variant="error" message={error} /> : null}
      {contract ? (
        <div className="space-y-6">
          <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Cliente</p><p className="font-medium text-slate-900 dark:text-white">{contract.account.legalName}</p><p className="text-xs text-slate-500">{contract.account.taxIdType} {contract.account.taxId}</p></div>
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Tenant</p><p className="font-medium text-slate-900 dark:text-white">{contract.tenant.name ?? contract.tenant.slug}</p></div>
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Plan</p><p className="font-medium text-slate-900 dark:text-white">{contract.plan.name}</p></div>
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Vigencia</p><p className="font-medium text-slate-900 dark:text-white">{formatDate(contract.startDate)} – {formatDate(contract.endDate)}</p>{current?.trialEndsOn ? <p className="text-xs text-slate-500">Prueba hasta {formatDate(current.trialEndsOn)}</p> : null}</div>
          </section>
          {contract.activePosTerminals > (current?.contractedPosTerminals ?? Infinity) ? (
            <Toast variant="warning" message="El tenant usa más terminales POS de las contratadas. Considera enmendar el contrato." />
          ) : null}

          {contract.status !== "DRAFT" && contract.status !== "CANCELLED" ? (
            <ContractChargesPanel contractId={contract.id} active={contract.status === "ACTIVE"} refreshKey={contract.updatedAt} />
          ) : null}

          {contract.versions.map((version) => (
            <section key={version.id} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Versión {version.versionNo}</h3>
                <button
                  type="button"
                  className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400"
                  disabled={downloading !== null}
                  onClick={() => void downloadPdf(version.id)}
                >
                  {downloading === version.id ? "Generando…" : "PDF"}
                </button>
                {version.effectiveTo ? <Pill tone="muted">{`${formatDate(version.effectiveFrom)} – ${formatDate(version.effectiveTo)}`}</Pill> : <Pill tone="ok">{`Vigente desde ${formatDate(version.effectiveFrom)}`}</Pill>}
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {TERM_PHASE_LABELS[version.termPhase]} · {FREQUENCY_LABELS[version.billingFrequency]} · {version.taxName} {formatRate(version.taxRate)} {version.pricesIncludeTax ? "incluido" : "aparte"} · prorrateo {version.prorationPolicy === "DAILY" ? "diario" : "no"}
                </span>
              </div>
              <ContractItemsTable items={version.items} />
              <TotalsSummary totals={version.totals} taxName={version.taxName} taxRate={version.taxRate} pricesIncludeTax={version.pricesIncludeTax} />
              {version.reason ? <p className="text-xs italic text-slate-500 dark:text-slate-400">Motivo: {version.reason}</p> : null}
            </section>
          ))}

          <section>
            <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">Auditoría</h3>
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white text-sm dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
              {contract.audit.map((event) => (
                <li key={event.id} className="flex flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium text-slate-800 dark:text-slate-100">{AUDIT_ACTION_LABELS[event.action] ?? event.action}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{new Date(event.occurredAt).toLocaleString("es-CO")}{event.reason ? ` · ${event.reason}` : ""}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      <ReasonDialog
        open={action === "activate"}
        title="Activar contrato"
        description="El contrato queda vigente y sus condiciones no se podrán editar; los cambios se hacen por enmienda."
        confirmText="Activar"
        variant="primary"
        onClose={() => setAction(null)}
        onConfirm={async (reason) => { setContract(await activateContract(contractId, reason)); }}
      />
      <ReasonDialog
        open={action === "cancel"}
        title="Cancelar borrador"
        confirmText="Cancelar contrato"
        variant="danger"
        requireReason={false}
        onClose={() => setAction(null)}
        onConfirm={async (reason) => { setContract(await cancelContract(contractId, reason || undefined)); }}
      />
      <ReasonDialog
        open={action === "void"}
        title="Anular contrato registrado por error"
        description="Úsalo solo si el contrato se registró con datos equivocados. Se anulan sus cargos (ninguno puede tener pagos aplicados), el contrato queda cancelado con su historial y el tenant queda libre para registrar el contrato correcto. Los pagos de la cuenta se conservan como saldo a favor. Para el fin real de la relación comercial usa Terminar."
        confirmText="Anular contrato"
        variant="danger"
        onClose={() => setAction(null)}
        onConfirm={async (reason) => { setContract(await voidContract(contractId, reason)); }}
      />
      <ReasonDialog
        open={action === "end"}
        title="Terminar contrato"
        description="Se cierra la versión vigente en la fecha indicada. Los cargos sin pagos de períodos posteriores se anulan."
        confirmText="Terminar"
        variant="danger"
        canConfirm={Boolean(endDate)}
        onClose={() => setAction(null)}
        onConfirm={async (reason) => { setContract(await endContract(contractId, endDate, reason)); }}
      >
        <Input label="Fecha de terminación" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </ReasonDialog>
      <ReasonDialog
        open={action === "amend"}
        title="Enmendar o renovar contrato"
        description="Se crea una nueva versión con los precios vigentes del plan en la fecha indicada. La versión actual se cierra el día anterior. Si la fecha cae dentro de un período ya cobrado y el prorrateo es diario, se genera un cargo o un crédito proporcional."
        confirmText="Crear versión"
        canConfirm={Boolean(amend.effectiveFrom)}
        onClose={() => setAction(null)}
        onConfirm={async (reason) => {
          setContract(
            await amendContract(contractId, {
              effectiveFrom: amend.effectiveFrom,
              termPhase: amend.termPhase,
              billingFrequency: amend.billingFrequency,
              extraPosTerminals: Number(amend.extraPosTerminals || 0),
              reason,
            }),
          );
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Rige desde" type="date" required value={amend.effectiveFrom} onChange={(e) => setAmend({ ...amend, effectiveFrom: e.target.value })} />
          <Select label="Condición" value={amend.termPhase} onChange={(e) => setAmend({ ...amend, termPhase: e.target.value as TermPhase })}>
            <option value="RENEWAL">Renovación</option>
            <option value="INITIAL">Término inicial</option>
          </Select>
          <Select label="Frecuencia" value={amend.billingFrequency} onChange={(e) => setAmend({ ...amend, billingFrequency: e.target.value as BillingFrequency })}>
            {BILLING_FREQUENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          <Input label="Terminales POS adicionales" type="number" min={0} value={amend.extraPosTerminals} onChange={(e) => setAmend({ ...amend, extraPosTerminals: e.target.value })} />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Renovación anual: certificación incluida (bono). Renovación mensual: certificación cobrada aparte.</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Para agregar o retirar terminales desde hoy, usa la fecha de hoy: se cobra o acredita la parte proporcional del período en curso. Una fecha anterior a un período ya pagado no se permite.</p>
      </ReasonDialog>
    </ControlCenterShell>
  );
};
