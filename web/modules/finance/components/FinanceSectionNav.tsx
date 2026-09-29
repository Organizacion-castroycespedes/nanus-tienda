"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowRight,
  ArrowRightLeft,
  Banknote,
  BriefcaseBusiness,
  CreditCard,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";

type FinanceSectionNavProps = {
  tenantSlug: string;
  canViewPaymentMethods: boolean;
  compact?: boolean;
};

const items: Array<{
  label: string;
  description: string;
  href: (tenant: string) => string;
  icon: LucideIcon;
}> = [
  {
    label: "Resumen",
    description: "Pulso operativo de la capa financiera",
    href: (tenant) => `/${tenant}/finance`,
    icon: BriefcaseBusiness,
  },
  {
    label: "Metodos de pago",
    description: "Catalogo, estado y reglas de cobro",
    href: (tenant) => `/${tenant}/finance/payment-methods`,
    icon: CreditCard,
  },
  {
    label: "Cajas",
    description: "Puntos de recaudo por sucursal",
    href: (tenant) => `/${tenant}/finance/cash-registers`,
    icon: Banknote,
  },
  {
    label: "Sesiones",
    description: "Aperturas, cierres y arqueo",
    href: (tenant) => `/${tenant}/finance/cash-sessions`,
    icon: ReceiptText,
  },
  {
    label: "Turno actual",
    description: "Ventas, pedidos, compras y tickets",
    href: (tenant) => `/${tenant}/finance/current-shift`,
    icon: Activity,
  },
  {
    label: "Movimientos",
    description: "Entradas, salidas y balance rapido",
    href: (tenant) => `/${tenant}/finance/cash-movements`,
    icon: ArrowRightLeft,
  },
];

const getCompactGridClass = (count: number) => {
  if (count >= 6) return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6";
  if (count === 5) return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5";
  if (count === 4) return "grid-cols-2 lg:grid-cols-4";
  if (count === 3) return "grid-cols-2 lg:grid-cols-3";
  if (count === 2) return "grid-cols-2";
  return "grid-cols-1";
};

export const FinanceSectionNav = ({
  tenantSlug,
  canViewPaymentMethods,
  compact = false,
}: FinanceSectionNavProps) => {
  const pathname = usePathname();
  const visibleItems = canViewPaymentMethods
    ? items
    : items.filter((item) => !item.href(tenantSlug).endsWith("/payment-methods"));

  return (
    <div
      className={
        compact
          ? `grid min-w-0 gap-2 ${getCompactGridClass(visibleItems.length)}`
          : `grid gap-3 ${
              canViewPaymentMethods ? "lg:grid-cols-6" : "lg:grid-cols-5"
            }`
      }
    >
      {visibleItems.map((item) => {
        const href = item.href(tenantSlug);
        const isActive = pathname === href;
        const Icon = item.icon;

        if (compact) {
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`group flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm transition hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 ${
                isActive
                  ? "border-blue-300 bg-blue-50 text-slate-900 ring-1 ring-blue-100 dark:border-blue-700 dark:bg-blue-950/40 dark:text-white dark:ring-blue-900"
                  : "border-slate-200 bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              <span
                className={`shrink-0 rounded-lg p-2 ${
                  isActive
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                    : "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{item.label}</span>
                <span className="mt-0.5 block truncate text-xs font-normal text-slate-500 dark:text-slate-400">
                  {item.description}
                </span>
              </span>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-blue-600"
                aria-hidden="true"
              />
            </Link>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            className={`group border shadow-sm transition ${
              compact ? "min-w-0 rounded-xl p-2.5" : "rounded-2xl p-4"
            } ${
              isActive
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-900 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            } dark:bg-slate-800 dark:border-slate-700 dark:text-white`}
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={`${compact ? "rounded-lg p-1.5" : "rounded-2xl p-2"} ${
                  isActive ? "bg-white/10 text-white" : "bg-amber-100 text-amber-700"
                }`}
              >
                <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
              </span>
            </div>
            <p className={compact ? "mt-2 truncate text-xs font-semibold" : "mt-4 text-sm font-semibold"}>
              {item.label}
            </p>
            <p
              className={`${compact ? "mt-0.5 truncate text-[11px]" : "mt-1 text-xs"} ${
                isActive ? "text-white/70" : "text-slate-500"
              } dark:text-slate-400`}
            >
              {item.description}
            </p>
          </Link>
        );
      })}
    </div>
  );
};
