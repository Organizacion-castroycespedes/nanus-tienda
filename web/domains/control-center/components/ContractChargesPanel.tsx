"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { Toast } from "../../../components/design-system/Toast";
import { generateCharges, listCharges } from "../api";
import { apiErrorMessage } from "../errors";
import { CHARGE_KIND_LABELS, FREQUENCY_LABELS, formatCOP, formatDate, isOverdue, todayInBogota } from "../format";
import type { Charge } from "../types";
import { ChargeDetailDialog } from "./ChargeDetailDialog";
import { ChargeStatusBadge } from "./StatusBadge";

type Props = { contractId: string; active: boolean; refreshKey?: unknown };

/** Cargos del contrato y botón para generar los que correspondan hasta la ventana de anticipación. */
export const ContractChargesPanel = ({ contractId, active, refreshKey }: Props) => {
  const [items, setItems] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [chargeId, setChargeId] = useState<string | null>(null);
  const today = todayInBogota();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await listCharges({ contractId, limit: 100 })).items);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const result = await generateCharges(contractId);
      setNotice(
        result.created.length === 0
          ? `No hay cargos nuevos hasta el ${formatDate(result.horizon)}.`
          : `Se generaron ${result.created.length} cargo(s): ${result.created.map((c) => c.chargeNumber).join(", ")}.`,
      );
      await load();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setGenerating(false);
    }
  };

  const columns: DataTableColumn<Charge>[] = [
    { key: "number", header: "Cargo", render: (row) => <button type="button" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400" onClick={() => setChargeId(row.id)}>{row.chargeNumber}</button> },
    { key: "concept", header: "Concepto", render: (row) => `${CHARGE_KIND_LABELS[row.kind]} ${FREQUENCY_LABELS[row.billingFrequency].toLowerCase()}` },
    { key: "period", header: "Período", render: (row) => `${formatDate(row.periodStart)} – ${formatDate(row.periodEnd)}` },
    { key: "due", header: "Vence", render: (row) => formatDate(row.dueDate) },
    { key: "total", header: "Total", render: (row) => formatCOP(row.totalAmount), cellClassName: "text-right" },
    { key: "balance", header: "Saldo", render: (row) => formatCOP(row.balance), cellClassName: "text-right" },
    { key: "status", header: "Estado", render: (row) => <ChargeStatusBadge status={row.status} overdue={isOverdue(row, today)} /> },
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Cargos</h3>
        {active ? (
          <Button size="sm" variant="secondary" onClick={() => void generate()} isLoading={generating}>
            <RefreshCw className="mr-1 h-4 w-4" aria-hidden /> Generar cargos
          </Button>
        ) : null}
      </div>
      {error ? <Toast variant="error" message={error} /> : null}
      {notice ? <Toast variant="success" message={notice} onClose={() => setNotice(null)} /> : null}
      <DataTable columns={columns} rows={items} getRowKey={(row) => row.id} loading={loading} emptyState="Aún no hay cargos. Se generan desde el fin de la prueba, 5 días antes de cada corte." />
      <ChargeDetailDialog chargeId={chargeId} onClose={() => setChargeId(null)} onChanged={() => void load()} />
    </section>
  );
};
