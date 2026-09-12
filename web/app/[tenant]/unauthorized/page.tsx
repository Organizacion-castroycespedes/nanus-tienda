"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "../../../components/design-system/Button";

const TenantUnauthorizedPage = () => {
  const params = useParams();
  const tenantParam = params?.tenant;
  const tenantSlug = Array.isArray(tenantParam) ? tenantParam[0] : tenantParam;
  const dashboardHref = tenantSlug ? `/${tenantSlug}/dashboard` : "/login";

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Unauthorized</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
          No tienes permiso para acceder a esta ruta.
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Tu sesion sigue activa, pero este recurso no esta habilitado para tu rol o permisos actuales.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={dashboardHref}>
            <Button variant="primary">Volver al Dashboard</Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default TenantUnauthorizedPage;
