"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { Input } from "../../../components/design-system/Input";
import { ReportSummary } from "../../../components/design-system/ReportSummary";
import { Tabs } from "../../../components/design-system/Tabs";
import { Toast } from "../../../components/design-system/Toast";
import { downloadBillingCollectionsXlsx, getBillingCollections, getRenewals } from "../api";
import { apiErrorMessage } from "../errors";
import { FREQUENCY_LABELS, RENEWAL_EVENT_LABELS, formatCOP, formatDate, moneyToCents, saveBlob, shiftMonth, todayInBogota } from "../format";
import type { BillingCollectionsMonth, BillingCollectionsReport, RenewalRow } from "../types";
import { ControlCenterShell, useControlCenterAccess, useControlCenterHref } from "./ControlCenterShell";
import { StatementDialog } from "./StatementDialog";
import { Pill } from "./StatusBadge";

const WINDOWS = [
  { value: "30", label: "30 días" },
  { value: "60", label: "60 días" },
  { value: "90", label: "90 días" },
];

const money = (value: string | null | undefined) =>
  value === null || value === undefined ? "—" : moneyToCents(value) === BigInt(0) ? <span className="text-slate-400">—</span> : formatCOP(value);

export const ReportsSection = () => {
  const { visible } = useControlCenterAccess();
  const href = useControlCenterHref();
  const currentMonth = todayInBogota().slice(0, 7);
  const [days, setDays] = useState<30 | 60 | 90>(30);
  const [renewals, setRenewals] = useState<RenewalRow[]>([]);
  const [renewalsLoading, setRenewalsLoading] = useState(false);
  const [months, setMonths] = useState({ from: shiftMonth(currentMonth, -11), to: currentMonth });
  const [report, setReport] = useState<BillingCollectionsReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRenewals = useCallback(async () => {
    setRenewalsLoading(true);
    try {
      setRenewals((await getRenewals(days)).items);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setRenewalsLoading(false);
    }
  }, [days]);

  const loadReport = useCallback(async () => {
    if (!months.from || !months.to || months.from > months.to) return;
    setReportLoading(true);
    try {
      setReport(await getBillingCollections(months));
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setReportLoading(false);
    }
  }, [months]);

  useEffect(() => {
    if (visible) void loadRenewals();
  }, [loadRenewals, visible]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => void loadReport(), 300);
    return () => clearTimeout(timer);
  }, [loadReport, visible]);

  const exportXlsx = async () => {
    setExporting(true);
    setError(null);
    try {
      saveBlob(await downloadBillingCollectionsXlsx(months), `facturado-vs-recaudado-${months.from}-${months.to}.xlsx`);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setExporting(false);
    }
  };

  const renewalColumns: DataTableColumn<RenewalRow>[] = [
    {
      key: "contract",
      header: "Contrato",
      render: (row) => (
        <div>
          <Link href={href(`contracts/${row.contractId}`)} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">{row.contractNumber}</Link>
          <p className="text-xs text-slate-500">{row.accountLegalName} · {row.tenantName}</p>
        </div>
      ),
    },
    { key: "event", header: "Evento", render: (row) => RENEWAL_EVENT_LABELS[row.type] },
    { key: "date", header: "Fecha", render: (row) => formatDate(row.date) },
    {
      key: "days",
      header: "Faltan",
      render: (row) => <Pill tone={row.daysRemaining <= 7 ? "danger" : row.daysRemaining <= 30 ? "warn" : "muted"}>{`${row.daysRemaining} días`}</Pill>,
    },
    { key: "current", header: "Valor actual", render: (row) => (row.currentValue ? `${formatCOP(row.currentValue)} ${FREQUENCY_LABELS[row.currentFrequency].toLowerCase()}` : "—") },
    {
      key: "renewal",
      header: "Renovación (catálogo vigente)",
      render: (row) =>
        row.type === "TRIAL_END" ? (
          <span className="text-xs text-slate-500">Inicia la facturación</span>
        ) : (
          <div className="text-xs">
            <p>Anual: {row.renewal.annual ? formatCOP(row.renewal.annual) : "—"}</p>
            <p>
              Mensual: {row.renewal.monthly ? formatCOP(row.renewal.monthly) : "—"}
              {row.renewal.monthlyAnnualExtras ? ` + ${formatCOP(row.renewal.monthlyAnnualExtras)}/año` : ""}
            </p>
          </div>
        ),
    },
    {
      key: "status",
      header: "Estado",
      render: (row) => (row.renewalRegistered ? <Pill tone="ok">Renovación registrada</Pill> : <Pill tone="warn">Pendiente</Pill>),
    },
  ];

  const methodColumns: DataTableColumn<BillingCollectionsMonth>[] = (report?.methods ?? []).map((method) => ({
    key: `m_${method.code}`,
    header: method.name,
    render: (row) => money(row.collectedByMethod[method.code]),
    cellClassName: "text-right",
  }));

  const monthColumns: DataTableColumn<BillingCollectionsMonth>[] = [
    { key: "month", header: "Mes", render: (row) => <span className="font-medium capitalize">{row.label}</span> },
    { key: "billed", header: "Facturado", render: (row) => money(row.billed), cellClassName: "text-right" },
    { key: "collected", header: "Recaudado", render: (row) => money(row.collected), cellClassName: "text-right" },
    ...methodColumns,
    { key: "credits", header: "Créditos prorrateo", render: (row) => money(row.prorationCredits), cellClassName: "text-right" },
    {
      key: "difference",
      header: "Diferencia",
      render: (row) => <span className={moneyToCents(row.difference) > BigInt(0) ? "text-rose-600 dark:text-rose-400" : ""}>{money(row.difference)}</span>,
      cellClassName: "text-right",
    },
  ];

  return (
    <ControlCenterShell
      section="reports"
      description="Estado de cuenta, facturado frente a recaudado y renovaciones por vencer."
      toolbar={
        <Button size="sm" onClick={() => setStatementOpen(true)}>
          <FileText className="mr-1 h-4 w-4" aria-hidden /> Estado de cuenta
        </Button>
      }
      summary={
        report ? (
          <ReportSummary
            items={[
              { label: "Facturado en el rango", value: formatCOP(report.totals.billed) },
              { label: "Recaudado en el rango", value: formatCOP(report.totals.collected) },
              { label: "Pendiente de esos cargos", value: formatCOP(report.totals.pending) },
              { label: "Renovaciones próximas", value: `${renewals.filter((r) => !r.renewalRegistered).length} en ${days} días` },
            ]}
          />
        ) : null
      }
    >
      {error ? <Toast variant="error" message={error} onClose={() => setError(null)} /> : null}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Renovaciones y pruebas por vencer</h3>
          <Tabs items={WINDOWS} value={String(days)} onChange={(value) => setDays(Number(value) as 30 | 60 | 90)} />
        </div>
        <DataTable
          columns={renewalColumns}
          rows={renewals}
          getRowKey={(row) => `${row.contractId}-${row.type}-${row.date}`}
          loading={renewalsLoading}
          emptyState={`Ningún contrato vence en los próximos ${days} días.`}
        />
      </section>

      <section className="mt-8 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Facturado frente a recaudado</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Facturado por mes de vencimiento; recaudado por mes de pago. Máximo 24 meses.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Input label="Desde" type="month" value={months.from} max={months.to} onChange={(e) => setMonths({ ...months, from: e.target.value })} />
            <Input label="Hasta" type="month" value={months.to} onChange={(e) => setMonths({ ...months, to: e.target.value })} />
            <Button variant="secondary" onClick={() => void exportXlsx()} isLoading={exporting} disabled={!report}>
              <FileSpreadsheet className="mr-1 h-4 w-4" aria-hidden /> Exportar Excel
            </Button>
          </div>
        </div>
        <DataTable columns={monthColumns} rows={report?.months ?? []} getRowKey={(row) => row.month} loading={reportLoading} emptyState="Sin datos en el rango." />
        {report ? (
          <p className="text-right text-sm font-semibold text-slate-900 dark:text-white">
            Total facturado {formatCOP(report.totals.billed)} · recaudado {formatCOP(report.totals.collected)} · diferencia {formatCOP(report.totals.difference)}
          </p>
        ) : null}
      </section>

      <StatementDialog open={statementOpen} onClose={() => setStatementOpen(false)} />
    </ControlCenterShell>
  );
};
