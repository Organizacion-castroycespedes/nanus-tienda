"use client";

import { useCallback, useEffect, useState } from "react";
import { HandCoins } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { Pagination } from "../../../components/design-system/Pagination";
import { ReportSummary } from "../../../components/design-system/ReportSummary";
import { SearchFilters } from "../../../components/design-system/SearchFilters";
import { Tabs } from "../../../components/design-system/Tabs";
import { Toast } from "../../../components/design-system/Toast";
import { getReceivablesSummary, listCharges, listReceipts } from "../api";
import { apiErrorMessage } from "../errors";
import { CHARGE_KIND_LABELS, formatCOP, formatDate, isOverdue, moneyToCents, todayInBogota } from "../format";
import type { Charge, Receipt, ReceivableAccount, ReceivablesSummary } from "../types";
import { AlertsPanel } from "./AlertsPanel";
import { ChargeDetailDialog } from "./ChargeDetailDialog";
import { ControlCenterShell, useControlCenterAccess } from "./ControlCenterShell";
import { ReceiptDetailDialog } from "./ReceiptDetailDialog";
import { RegisterPaymentDialog } from "./RegisterPaymentDialog";
import { ChargeStatusBadge, ReceiptStatusBadge } from "./StatusBadge";

type View = "accounts" | "charges" | "receipts";

const VIEWS = [
  { value: "accounts", label: "Por cuenta" },
  { value: "charges", label: "Cargos" },
  { value: "receipts", label: "Pagos" },
];

const CHARGE_FILTERS = [
  { value: "pending", label: "Pendientes" },
  { value: "overdue", label: "Vencidos" },
  { value: "paid", label: "Pagados" },
  { value: "void", label: "Anulados" },
  { value: "all", label: "Todos" },
];

const RECEIPT_FILTERS = [
  { value: "confirmed", label: "Confirmados" },
  { value: "balance", label: "Con saldo a favor" },
  { value: "void", label: "Anulados" },
  { value: "all", label: "Todos" },
];

const money = (value: string) => (moneyToCents(value) === BigInt(0) ? <span className="text-slate-400">—</span> : formatCOP(value));

export const ReceivablesSection = () => {
  const { visible } = useControlCenterAccess();
  const [view, setView] = useState<View>("accounts");
  const [summary, setSummary] = useState<ReceivablesSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [chargeFilter, setChargeFilter] = useState("pending");
  const [receiptFilter, setReceiptFilter] = useState("confirmed");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [charges, setCharges] = useState<{ items: Charge[]; total: number }>({ items: [], total: 0 });
  const [receipts, setReceipts] = useState<{ items: Receipt[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [paymentFor, setPaymentFor] = useState<string | undefined | null>(null);
  const [chargeId, setChargeId] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const today = todayInBogota();

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await getReceivablesSummary());
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }, []);

  const loadList = useCallback(async () => {
    if (view === "accounts") return;
    setLoading(true);
    setError(null);
    try {
      const paging = { search: search.trim(), limit: pageSize, offset: (page - 1) * pageSize };
      if (view === "charges") {
        const status = { pending: "OPEN,PARTIALLY_PAID", overdue: undefined, paid: "PAID", void: "VOID", all: undefined }[chargeFilter];
        const result = await listCharges({ ...paging, status, overdue: chargeFilter === "overdue" });
        setCharges({ items: result.items, total: result.total });
      } else {
        const status = receiptFilter === "confirmed" ? "CONFIRMED" : receiptFilter === "void" ? "VOID" : undefined;
        const result = await listReceipts({ ...paging, status, withBalance: receiptFilter === "balance" });
        setReceipts({ items: result.items, total: result.total });
      }
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [chargeFilter, page, pageSize, receiptFilter, search, view]);

  useEffect(() => {
    if (visible) void loadSummary();
  }, [loadSummary, visible]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => void loadList(), 250);
    return () => clearTimeout(timer);
  }, [loadList, visible]);

  const refresh = () => {
    void loadSummary();
    void loadList();
  };

  const accountColumns: DataTableColumn<ReceivableAccount>[] = [
    { key: "account", header: "Cuenta", render: (row) => <div><p className="font-medium text-slate-900 dark:text-white">{row.legalName}</p><p className="text-xs text-slate-500">{row.taxIdType} {row.taxId}</p></div> },
    { key: "open", header: "Saldo", render: (row) => money(row.openBalance), cellClassName: "text-right" },
    { key: "notDue", header: "Por vencer", render: (row) => money(row.notDue), cellClassName: "text-right" },
    { key: "d30", header: "1-30 días", render: (row) => money(row.days1to30), cellClassName: "text-right" },
    { key: "d60", header: "31-60", render: (row) => money(row.days31to60), cellClassName: "text-right" },
    { key: "d90", header: "61-90", render: (row) => money(row.days61to90), cellClassName: "text-right" },
    { key: "over", header: "> 90", render: (row) => <span className={moneyToCents(row.over90) > BigInt(0) ? "font-semibold text-rose-600 dark:text-rose-400" : ""}>{money(row.over90)}</span>, cellClassName: "text-right" },
    { key: "credit", header: "A favor", render: (row) => money(row.credit), cellClassName: "text-right" },
    { key: "actions", header: "", render: (row) => <Button size="sm" variant="ghost" onClick={() => setPaymentFor(row.accountId)}>Registrar pago</Button> },
  ];

  const chargeColumns: DataTableColumn<Charge>[] = [
    { key: "number", header: "Cargo", render: (row) => <button type="button" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400" onClick={() => setChargeId(row.id)}>{row.chargeNumber}</button> },
    { key: "account", header: "Cuenta / contrato", render: (row) => <div><p className="text-slate-900 dark:text-white">{row.accountLegalName}</p><p className="text-xs text-slate-500">{row.contractNumber} · {row.tenantName ?? ""}</p></div> },
    { key: "concept", header: "Concepto", render: (row) => `${CHARGE_KIND_LABELS[row.kind]} ${formatDate(row.periodStart)} – ${formatDate(row.periodEnd)}` },
    { key: "due", header: "Vence", render: (row) => formatDate(row.dueDate) },
    { key: "total", header: "Total", render: (row) => formatCOP(row.totalAmount), cellClassName: "text-right" },
    { key: "balance", header: "Saldo", render: (row) => formatCOP(row.balance), cellClassName: "text-right" },
    { key: "status", header: "Estado", render: (row) => <ChargeStatusBadge status={row.status} overdue={isOverdue(row, today)} /> },
  ];

  const receiptColumns: DataTableColumn<Receipt>[] = [
    { key: "number", header: "Pago", render: (row) => <button type="button" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400" onClick={() => setReceiptId(row.id)}>{row.receiptNumber}</button> },
    { key: "account", header: "Cuenta", render: (row) => row.accountLegalName },
    { key: "date", header: "Fecha", render: (row) => formatDate(row.receivedOn) },
    { key: "method", header: "Medio", render: (row) => (row.source === "PRORATION_CREDIT" ? "Crédito por prorrateo" : `${row.paymentMethodName ?? ""}${row.reference ? ` · ${row.reference}` : ""}`) },
    { key: "amount", header: "Valor", render: (row) => formatCOP(row.amount), cellClassName: "text-right" },
    { key: "unallocated", header: "A favor", render: (row) => money(row.unallocated), cellClassName: "text-right" },
    { key: "status", header: "Estado", render: (row) => <ReceiptStatusBadge status={row.status} /> },
  ];

  const totals = summary?.totals;

  return (
    <ControlCenterShell
      section="receivables"
      description="Cartera: cargos generados, pagos recibidos y vencimientos."
      toolbar={<Button size="sm" onClick={() => setPaymentFor(undefined)}><HandCoins className="mr-1 h-4 w-4" aria-hidden /> Registrar pago</Button>}
      summary={
        totals ? (
          <ReportSummary
            items={[
              { label: "Saldo por cobrar", value: formatCOP(totals.openBalance) },
              { label: "Vencido", value: <span className={moneyToCents(totals.overdue) > BigInt(0) ? "text-rose-600 dark:text-rose-400" : ""}>{formatCOP(totals.overdue)}</span> },
              { label: `Vence en 15 días`, value: formatCOP(totals.upcoming) },
              { label: "Saldo a favor", value: formatCOP(totals.credit) },
            ]}
          />
        ) : null
      }
    >
      {error ? <Toast variant="error" message={error} /> : null}
      {notice ? <Toast variant="success" message={notice} onClose={() => setNotice(null)} /> : null}
      <AlertsPanel onRun={refresh} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs items={VIEWS} value={view} onChange={(value) => { setView(value as View); setPage(1); }} />
        {view !== "accounts" ? (
          <SearchFilters
            className="lg:min-w-[32rem]"
            query={search}
            onQueryChange={(value) => { setSearch(value); setPage(1); }}
            queryLabel="Buscar"
            queryPlaceholder={view === "charges" ? "Cargo, contrato o cliente" : "Pago, referencia o cliente"}
            status={view === "charges" ? chargeFilter : receiptFilter}
            onStatusChange={(value) => { (view === "charges" ? setChargeFilter : setReceiptFilter)(value); setPage(1); }}
            statusLabel="Estado"
            statusOptions={view === "charges" ? CHARGE_FILTERS : RECEIPT_FILTERS}
          />
        ) : null}
      </div>

      {view === "accounts" ? (
        <>
          <DataTable
            columns={accountColumns}
            rows={summary?.accounts ?? []}
            getRowKey={(row) => row.accountId}
            loading={!summary && !error}
            emptyState="No hay saldos pendientes ni saldos a favor."
          />
          {summary && summary.upcoming.length > 0 ? (
            <section className="mt-6">
              <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">Próximos vencimientos (hasta {formatDate(summary.upcomingUntil)})</h3>
              <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white text-sm dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
                {summary.upcoming.map((charge) => (
                  <li key={charge.id} className="flex flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <button type="button" className="text-left font-medium text-indigo-600 hover:underline dark:text-indigo-400" onClick={() => setChargeId(charge.id)}>
                      {charge.chargeNumber} · {charge.accountLegalName}
                    </button>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(charge.dueDate)} · {formatCOP(charge.balance)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <>
          {view === "charges" ? (
            <DataTable columns={chargeColumns} rows={charges.items} getRowKey={(row) => row.id} loading={loading} emptyState="No hay cargos con este filtro." />
          ) : (
            <DataTable columns={receiptColumns} rows={receipts.items} getRowKey={(row) => row.id} loading={loading} emptyState="No hay pagos con este filtro." />
          )}
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={view === "charges" ? charges.total : receipts.total}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            loading={loading}
          />
        </>
      )}

      <RegisterPaymentDialog
        open={paymentFor !== null}
        accountId={paymentFor ?? undefined}
        onClose={() => setPaymentFor(null)}
        onSaved={(receipt) => {
          setNotice(`Pago ${receipt.receiptNumber} registrado.`);
          refresh();
        }}
      />
      <ChargeDetailDialog chargeId={chargeId} onClose={() => setChargeId(null)} onChanged={refresh} />
      <ReceiptDetailDialog receiptId={receiptId} onClose={() => setReceiptId(null)} onChanged={refresh} />
    </ControlCenterShell>
  );
};
