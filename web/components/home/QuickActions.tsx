import Link from "next/link";
import { QUICK_ACTIONS, type QuickAction } from "./home-config";

const accentStyles: Record<QuickAction["accent"], string> = {
  primary: "bg-blue-50 text-blue-700 group-hover:bg-blue-100",
  emerald: "bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100",
  amber: "bg-amber-50 text-amber-700 group-hover:bg-amber-100",
  slate: "bg-slate-100 text-slate-700 group-hover:bg-slate-200",
};

export const QuickActions = ({ tenant }: { tenant: string }) => {
  return (
    <section aria-labelledby="quick-actions-title">
      <h2
        id="quick-actions-title"
        className="text-lg font-semibold text-slate-900 dark:text-white"
      >
        Acciones rápidas
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Lo más usado en el día a día de tu tienda.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.key}
              href={action.href(tenant)}
              className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:translate-y-0 dark:bg-slate-800 dark:border-slate-700"
            >
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition ${accentStyles[action.accent]}`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                  {action.title}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {action.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
};
