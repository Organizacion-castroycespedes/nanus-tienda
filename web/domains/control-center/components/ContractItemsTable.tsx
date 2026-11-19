import { DataTable } from "../../../components/design-system/DataTable";
import { FREQUENCY_LABELS, formatCOP, formatRate } from "../format";
import type { ContractItem, ItemFrequency, TotalsByFrequency } from "../types";
import { Pill } from "./StatusBadge";

const BONUS_LABELS: Record<string, string> = {
  INCLUIDA_TERMINO_INICIAL: "Incluida en el término inicial",
  FIDELIDAD_RENOVACION_ANUAL: "Bono de fidelidad",
};

export const ContractItemsTable = ({ items }: { items: ContractItem[] }) => (
  <DataTable
    disableHeaderUppercase
    columns={[
      {
        key: "description",
        header: "Concepto",
        render: (item) => (
          <div className="flex flex-wrap items-center gap-2">
            <span>{item.description}</span>
            {typeof item.metadata?.bonus === "string" ? <Pill tone="ok">{BONUS_LABELS[item.metadata.bonus] ?? item.metadata.bonus}</Pill> : null}
            {item.metadata?.catalogUnitAmount ? <Pill tone="warn">{`Ajustado (catálogo ${formatCOP(String(item.metadata.catalogUnitAmount))})`}</Pill> : null}
          </div>
        ),
      },
      { key: "frequency", header: "Frecuencia", render: (item) => FREQUENCY_LABELS[item.billingFrequency] },
      { key: "quantity", header: "Cant.", render: (item) => Number(item.quantity) },
      { key: "unit", header: "Valor unitario", render: (item) => formatCOP(item.unitAmount) },
      { key: "discount", header: "Descuento", render: (item) => (Number(item.discountAmount) > 0 ? `− ${formatCOP(item.discountAmount)}` : "—") },
    ]}
    rows={items}
    getRowKey={(item) => item.id ?? `${item.itemType}-${item.description}-${item.billingFrequency}`}
  />
);

const ORDER: ItemFrequency[] = ["ANNUAL", "MONTHLY", "ONE_TIME"];

export const TotalsSummary = ({
  totals,
  taxName,
  taxRate,
  pricesIncludeTax,
}: {
  totals: TotalsByFrequency;
  taxName: string;
  taxRate: string;
  pricesIncludeTax: boolean;
}) => (
  <div className="grid gap-3 sm:grid-cols-3">
    {ORDER.filter((frequency) => totals[frequency]).map((frequency) => {
      const value = totals[frequency]!;
      return (
        <div key={frequency} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total {FREQUENCY_LABELS[frequency].toLowerCase()}</p>
          <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{formatCOP(value.total)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Base {formatCOP(value.base)} · {taxName} {formatRate(taxRate)} {formatCOP(value.tax)}
            {pricesIncludeTax ? " (incluido)" : ""}
          </p>
        </div>
      );
    })}
  </div>
);
