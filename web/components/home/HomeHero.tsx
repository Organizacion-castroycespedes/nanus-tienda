import Link from "next/link";
import { ArrowRight, Sparkles, Wallet } from "lucide-react";

type HomeHeroProps = {
  tenant: string;
  userName: string;
  businessName: string;
  version: string;
};

export const HomeHero = ({
  tenant,
  userName,
  businessName,
  version,
}: HomeHeroProps) => {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Manus POS · {version}
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 text-balance sm:text-3xl">
            Bienvenido a Manus POS
          </h1>
          <p className="mt-1 text-base font-medium text-slate-700">
            {businessName}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 text-pretty">
            Hola, <span className="font-semibold text-slate-900">{userName}</span>.
            Gestiona tus ventas, inventario, caja y pedidos desde un solo lugar.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/${tenant}/pos`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Ir al POS
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href={`/${tenant}/finance`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              <Wallet className="h-4 w-4" aria-hidden="true" />
              Ver caja
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 lg:w-64">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Estado del producto
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            Manus POS {version}
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <p className="flex items-center gap-2 text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              Base operativa activa
            </p>
            <p className="text-slate-600">Módulos principales disponibles</p>
          </div>
        </div>
      </div>
    </section>
  );
};
