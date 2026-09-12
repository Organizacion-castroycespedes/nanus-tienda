import {
  AlertTriangle,
  ClipboardList,
  PackageOpen,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type SummaryStatus = "data" | "empty" | "error";

export type SummaryCardData = {
  key: string;
  label: string;
  icon: LucideIcon;
  status: SummaryStatus;
  value?: string;
  hint?: string;
};

const Card = ({ card }: { card: SummaryCardData }) => {
  const Icon = card.icon;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {card.label}
        </p>
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:text-slate-300">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>

      {card.status === "data" ? (
        <>
          <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
            {card.value}
          </p>
          {card.hint ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{card.hint}</p>
          ) : null}
        </>
      ) : null}

      {card.status === "empty" ? (
        <>
          <p className="mt-3 text-lg font-semibold text-slate-400">Sin datos</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {card.hint ?? "Aún no hay información para mostrar."}
          </p>
        </>
      ) : null}

      {card.status === "error" ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <p className="text-xs leading-relaxed text-amber-800">
            {card.hint ?? "No se pudo cargar. Intenta de nuevo."}
          </p>
        </div>
      ) : null}
    </div>
  );
};

export const SummaryCards = ({ cards }: { cards: SummaryCardData[] }) => {
  return (
    <section aria-labelledby="summary-title">
      <h2 id="summary-title" className="text-lg font-semibold text-slate-900 dark:text-white">
        Resumen operativo
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Una mirada rápida al estado de hoy.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.key} card={card} />
        ))}
      </div>
    </section>
  );
};

export const summaryIcons = {
  sales: TrendingUp,
  cash: Wallet,
  orders: ClipboardList,
  stock: PackageOpen,
} satisfies Record<string, LucideIcon>;
