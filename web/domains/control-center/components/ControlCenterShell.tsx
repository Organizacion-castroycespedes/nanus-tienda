"use client";

import type { ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { ReportLayout } from "../../../components/design-system/ReportLayout";
import { Tabs } from "../../../components/design-system/Tabs";
import { hasMenuAccess } from "../../../lib/permissions";
import { useAppSelector } from "../../../store/hooks";
import { MENU_KEYS } from "../../menu/constants";
import { canSeeControlCenter } from "../access";

export type ControlCenterSection = "overview" | "tenants" | "accounts" | "plans" | "contracts";

const SECTIONS: { value: ControlCenterSection; label: string }[] = [
  { value: "overview", label: "Resumen" },
  { value: "tenants", label: "Tenants" },
  { value: "accounts", label: "Cuentas" },
  { value: "plans", label: "Planes" },
  { value: "contracts", label: "Contratos" },
];

export const useControlCenterAccess = () => {
  const role = useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? "");
  const tenantId = useAppSelector((state) => state.auth.user?.tenantId ?? state.auth.tenantId);
  const permissionsLoaded = useAppSelector((state) => state.auth.permissionsLoaded);
  return {
    permissionsLoaded,
    visible: canSeeControlCenter({ role, tenantId, hasReadAccess: hasMenuAccess(MENU_KEYS.CONTROL_CENTER, "READ") }),
  };
};

export const useControlCenterHref = () => {
  const params = useParams<{ tenant: string }>();
  const tenant = Array.isArray(params?.tenant) ? params.tenant[0] : params?.tenant;
  return (path = "") => `/${tenant}/control-center${path ? `/${path}` : ""}`;
};

export const AccessRestricted = () => (
  <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
    <ShieldAlert className="mx-auto h-10 w-10 text-slate-400" aria-hidden />
    <h1 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">Acceso restringido</h1>
    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">No tienes acceso al Control Center.</p>
  </section>
);

type ShellProps = {
  section: ControlCenterSection;
  description: string;
  toolbar?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
};

/** Marco común del Control Center: acceso, encabezado y navegación por secciones. */
export const ControlCenterShell = ({ section, description, toolbar, summary, children }: ShellProps) => {
  const { permissionsLoaded, visible } = useControlCenterAccess();
  const href = useControlCenterHref();
  const router = useRouter();

  if (!permissionsLoaded) {
    return <p className="p-6 text-sm text-slate-500 dark:text-slate-400">Cargando permisos…</p>;
  }
  if (!visible) return <AccessRestricted />;

  return (
    <ReportLayout
      title="MANUS Control Center"
      description={description}
      toolbar={
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            items={SECTIONS}
            value={section}
            onChange={(value) => router.push(href(value === "overview" ? "" : value))}
          />
          {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
        </div>
      }
      summary={summary}
    >
      {children}
    </ReportLayout>
  );
};
