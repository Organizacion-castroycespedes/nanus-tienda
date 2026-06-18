import Link from "next/link";
import { HOME_MODULES } from "./home-config";

export const ModulesGrid = ({ tenant }: { tenant: string }) => {
  return (
    <section aria-labelledby="modules-title">
      <h2 id="modules-title" className="text-lg font-semibold text-slate-900">
        Módulos disponibles
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Accede a cualquier área del sistema.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {HOME_MODULES.map((module) => {
          const Icon = module.icon;
          return (
            <Link
              key={module.key}
              href={module.href(tenant)}
              className="group flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700 transition group-hover:bg-blue-50 group-hover:text-blue-700">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {module.title}
              </span>
              <span className="text-xs leading-relaxed text-slate-500">
                {module.description}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
};
