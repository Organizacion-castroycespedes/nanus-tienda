"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowRightLeft,
  Banknote,
  BriefcaseBusiness,
  CreditCard,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";

type FinanceSectionNavProps = {
  tenantSlug: string;
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

export const FinanceSectionNav = ({ tenantSlug }: FinanceSectionNavProps) => {
  const pathname = usePathname();

  return (
    <div className="grid gap-3 lg:grid-cols-6">
      {items.map((item) => {
        const href = item.href(tenantSlug);
        const isActive = pathname === href;
        const Icon = item.icon;

        return (
          <Link
            key={href}
            href={href}
            className={`group rounded-2xl border p-4 shadow-sm transition ${
              isActive
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-900 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            } dark:bg-slate-800 dark:border-slate-700 dark:text-white`}
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={`rounded-2xl p-2 ${
                  isActive ? "bg-white/10 text-white" : "bg-amber-100 text-amber-700"
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold">{item.label}</p>
            <p
              className={`mt-1 text-xs ${
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
