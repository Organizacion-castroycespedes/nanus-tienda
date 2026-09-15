"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Select } from "../../../components/design-system/Select";
import {
  listFiscalReviewCustomers,
  listFiscalReviewSuppliers,
  type FiscalReviewRow,
} from "../../../modules/electronic-invoicing/services/fiscal-profile-review.service";

const FiscalReviewPage = () => {
  const [rows, setRows] = useState<FiscalReviewRow[]>([]);
  const [entity, setEntity] = useState<"all" | "customer" | "supplier">("all");
  const [completeness, setCompleteness] = useState<"incomplete" | "complete" | "all">("incomplete");
  const [missingField, setMissingField] = useState("");
  const [fiscalStatus, setFiscalStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const query = { completeness, ...(missingField ? { missingField } : {}), ...(fiscalStatus ? { fiscalStatus } : {}) };
    Promise.all([
      entity === "supplier" ? Promise.resolve([]) : listFiscalReviewCustomers(query),
      entity === "customer" ? Promise.resolve([]) : listFiscalReviewSuppliers(query),
    ])
      .then(([customers, suppliers]) => active && setRows([...customers, ...suppliers]))
      .catch(() => active && setError("No fue posible cargar la cola de revisión fiscal."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [completeness, entity, missingField, fiscalStatus]);

  const counts = useMemo(
    () => ({
      review: rows.filter((row) => row.classification === "REQUIRES_HUMAN_FISCAL_REVIEW").length,
      exceptions: rows.filter((row) => row.classification === "FINAL_CONSUMER_EXCEPTION").length,
    }),
    [rows]
  );

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Administración</p>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Revisión fiscal</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Completa perfiles pendientes con valores fiscales y geográficos controlados.
        </p>
      </header>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4 dark:border-slate-700 dark:bg-slate-800">
        <Select label="Entidad" value={entity} onChange={(event) => setEntity(event.target.value as typeof entity)}>
          <option value="all">Clientes y proveedores</option>
          <option value="customer">Clientes</option>
          <option value="supplier">Proveedores</option>
        </Select>
        <Select label="Completitud" value={completeness} onChange={(event) => setCompleteness(event.target.value as typeof completeness)}>
          <option value="incomplete">Requieren revisión</option>
          <option value="complete">Completos</option>
          <option value="all">Todos</option>
        </Select>
        <Select label="Campo faltante" value={missingField} onChange={(event) => setMissingField(event.target.value)}>
          <option value="">Todos</option>
          <option value="personType">Tipo de persona</option>
          <option value="taxRegime">Régimen tributario</option>
          <option value="taxResponsibilities">Responsabilidades fiscales</option>
          <option value="location">Ubicación</option>
        </Select>
        <Select label="Estado fiscal" value={fiscalStatus} onChange={(event) => setFiscalStatus(event.target.value)}>
          <option value="">Todos</option>
          <option value="REQUIRES_HUMAN_FISCAL_REVIEW">Requiere revisión</option>
          <option value="NOT_REQUIRED">No requerido</option>
          <option value="PENDING">Pendiente</option>
          <option value="VALIDATED">Validado</option>
          <option value="FAILED">Fallido</option>
        </Select>
      </section>

      <section className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800">Revisión humana: {counts.review}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">Excepciones consumidor final: {counts.exceptions}</span>
      </section>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 dark:bg-slate-700 dark:text-slate-200">
            <tr><th className="px-4 py-3">Entidad</th><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Ubicación</th><th className="px-4 py-3">Faltantes / estado</th><th className="px-4 py-3">Acción</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="px-4 py-8 text-center">Cargando revisión fiscal...</td></tr> : null}
            {!loading && rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No hay registros para estos filtros.</td></tr> : null}
            {!loading && rows.map((row) => {
              const path = row.entityType === "customer" ? "customers" : "suppliers";
              const query = row.entityType === "customer" ? `editCustomerId=${row.id}` : `editSupplierId=${row.id}`;
              return <tr key={`${row.entityType}-${row.id}`} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-3 capitalize">{row.entityType === "customer" ? "Cliente" : "Proveedor"}</td>
                <td className="px-4 py-3 font-medium">{row.name}</td>
                <td className="px-4 py-3">{row.documentType ?? "-"} {row.maskedDocument ?? ""}</td>
                <td className="px-4 py-3">{[row.location.municipalityName, row.location.departmentName, row.location.countryCode].filter(Boolean).join(", ") || "Pendiente"}</td>
                <td className="px-4 py-3"><div>{row.classification === "FINAL_CONSUMER_EXCEPTION" ? "No requiere perfil fiscal" : row.missingFields.join(", ") || "Completo"}</div><div className="text-xs text-slate-500">{row.reviewReason}</div></td>
                <td className="px-4 py-3"><Link href={`/${window.location.pathname.split("/")[1]}/${path}?${query}`}><Button type="button" variant="secondary">Revisar</Button></Link></td>
              </tr>;
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
};

export default FiscalReviewPage;
