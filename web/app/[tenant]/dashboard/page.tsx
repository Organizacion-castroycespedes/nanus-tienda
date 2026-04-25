"use client";

import { useEffect, useState } from "react";
import { fetchProfile } from "../../../domains/auth/api";
import type { AuthUser } from "../../../domains/auth/types";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import { setUser } from "../../../store/authSlice";

const DashboardPage = () => {
  const authUser = useAppSelector((state) => state.auth.user);
  const authStatus = useAppSelector((state) => state.auth.authStatus);
  const [user, setUserState] = useState<AuthUser | null>(authUser);
  const dispatch = useAppDispatch();
  const companyDetails = useAppSelector((state) => state.company.details);
  const fullName = user?.name || user?.email || "Usuario";
  const companyName =
    companyDetails?.razonSocial || user?.tenantName || "Sin compañía asignada";
  const branchName = user?.branchName || "Sin sucursal activa";
  const roleName = user?.role || "Sin rol";
  const documento = [user?.persona?.documentoTipo, user?.persona?.documentoNumero]
    .filter(Boolean)
    .join(" ");
  const cargo = user?.persona?.cargoNombre || "Sin cargo";

  useEffect(() => {
    setUserState(authUser);
    const shouldFetchProfile =
      authStatus === "authenticated" && (!authUser?.name || !authUser?.tenantName);
    if (!shouldFetchProfile) {
      return;
    }
    void (async () => {
      try {
        const profile = await fetchProfile();
        const fullName = [profile.persona?.nombres, profile.persona?.apellidos]
          .filter(Boolean)
          .join(" ");
        const nextUser: AuthUser = {
          id: profile.id,
          name: fullName || profile.email,
          email: profile.email,
          role: profile.role?.nombre ?? authUser?.role ?? "",
          tenantId: profile.tenant.id,
          tenantName: profile.tenant.nombre,
          branchId: profile.branch?.id ?? null,
          branchName: profile.branch?.nombre ?? null,
          persona: profile.persona,
        };
        dispatch(setUser(nextUser));
        setUserState(nextUser);
      } catch {
        // ignore profile fetch failures
      }
    })();
  }, [authStatus, authUser, dispatch]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Panel principal
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
            <p className="mt-2 text-sm text-slate-600">
              Bienvenido, <span className="font-semibold">{fullName}</span>.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-900">Contexto activo</p>
            <p className="mt-1">Tenant: {companyName}</p>
            <p>Sucursal: {branchName}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Compañía
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {companyName}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {companyDetails?.nit ? `NIT ${companyDetails.nit}` : "Tenant activo"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Sucursal activa
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {branchName}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {user?.branchId ? "Asignación principal" : "Pendiente de asignación"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Rol</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {roleName}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Accesos gestionados por permisos
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Perfil del usuario
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Información básica de la cuenta autenticada.
          </p>
          <dl className="mt-6 grid gap-4 text-sm text-slate-700 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Nombre
              </dt>
              <dd className="mt-1 font-medium text-slate-900">{fullName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Email
              </dt>
              <dd className="mt-1 font-medium text-slate-900">
                {user?.email || "Sin correo"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Documento
              </dt>
              <dd className="mt-1 font-medium text-slate-900">
                {documento || "Sin documento"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Cargo
              </dt>
              <dd className="mt-1 font-medium text-slate-900">{cargo}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Teléfono
              </dt>
              <dd className="mt-1 font-medium text-slate-900">
                {user?.persona?.telefono || "Sin teléfono"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Dirección
              </dt>
              <dd className="mt-1 font-medium text-slate-900">
                {user?.persona?.direccion || "Sin dirección"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Contexto de trabajo
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Datos clave del entorno activo.
          </p>
          <div className="mt-6 space-y-4 text-sm text-slate-700">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Tenant
              </p>
              <p className="mt-1 font-semibold text-slate-900">{companyName}</p>
              <p className="text-xs text-slate-500">
                ID: {user?.tenantId || "No disponible"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Sucursal activa
              </p>
              <p className="mt-1 font-semibold text-slate-900">{branchName}</p>
              <p className="text-xs text-slate-500">
                {user?.branchId ? `ID: ${user.branchId}` : "Sin asignación"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Rol actual
              </p>
              <p className="mt-1 font-semibold text-slate-900">{roleName}</p>
              <p className="text-xs text-slate-500">
                Acceso gestionado por permisos configurados
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
