"use client";

import { FileText, Plus, RefreshCw, Search, Settings2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../components/design-system/Toast";
import { useAutoClearState } from "../../../lib/useAutoClearState";
import { PdfPreviewModal } from "../../../modules/reporteria/components/PdfPreviewModal";
import { getApiErrorMessage } from "../../../modules/reporteria/utils";
import { QuotationSettingsDialog } from "../../../modules/quotations/components/QuotationDialogs";
import { QuotationStatusBadge } from "../../../modules/quotations/components/QuotationStatusBadge";
import { useQuotationPermissions } from "../../../modules/quotations/hooks/use-quotation-permissions";
import { daysUntil, formatQuotationDate, formatQuotationMoney } from "../../../modules/quotations/quotation-format";
import {
  getQuotationPdf,
  getQuotationSettings,
  listQuotations,
  updateQuotationSettings,
} from "../../../modules/quotations/services/quotation.service";
import {
  QUOTATION_STATUS_OPTIONS,
  type QuotationEffectiveStatus,
  type QuotationHeader,
  type QuotationListResponse,
} from "../../../modules/quotations/types";

const PAGE_SIZE = 15;

type Filters = { search: string; status: QuotationEffectiveStatus | ""; fromDate: string; toDate: string };
const emptyFilters: Filters = { search: "", status: "", fromDate: "", toDate: "" };

const validityLabel = (quotation: QuotationHeader) => {
  if (quotation.effectiveStatus === "EXPIRED") {
    return "Vencida";
  }
  if (quotation.effectiveStatus === "CONVERTED" || quotation.effectiveStatus === "REJECTED") {
    return null;
  }
  const days = daysUntil(quotation.validUntil);
  return days === 0 ? "Vence hoy" : `${days} día${days === 1 ? "" : "s"}`;
};

const CotizacionesPage = () => {
  const params = useParams<{ tenant: string }>();
  const tenant = params?.tenant ?? "default";
  const permissions = useQuotationPermissions();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<QuotationListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewQuotation, setPreviewQuotation] = useState<QuotationHeader | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [validityDays, setValidityDays] = useState(15);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  useAutoClearState(toastMessage, setToastMessage);

  const notify = (message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  };

  const load = useCallback(async (nextFilters: Filters, nextPage: number) => {
    setLoading(true);
    try {
      const response = await listQuotations({
        search: nextFilters.search,
        status: nextFilters.status,
        fromDate: nextFilters.fromDate || undefined,
        toDate: nextFilters.toDate || undefined,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      setResult(response);
      setPage(response.meta.page);
    } catch (error) {
      notify(getApiErrorMessage(error, "No se pudieron cargar las cotizaciones."), "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (permissions.view) {
      void load(emptyFilters, 1);
    }
  }, [load, permissions.view]);

  useEffect(() => {
    if (permissions.settings) {
      getQuotationSettings()
        .then((settings) => setValidityDays(settings.defaultValidityDays))
        .catch(() => undefined);
    }
  }, [permissions.settings]);

  const applyFilters = () => {
    setApplied(filters);
    void load(filters, 1);
  };

  const saveSettings = async (days: number) => {
    setSettingsSaving(true);
    try {
      const saved = await updateQuotationSettings(days);
      setValidityDays(saved.defaultValidityDays);
      setSettingsOpen(false);
      notify(`Vigencia por defecto: ${saved.defaultValidityDays} días.`, "success");
    } catch (error) {
      notify(getApiErrorMessage(error, "No se pudo guardar la vigencia."), "error");
    } finally {
      setSettingsSaving(false);
    }
  };

  if (!permissions.view) {
    return permissions.ready ? (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        No tienes permisos para ver cotizaciones.
      </div>
    ) : null;
  }

  const summary = result?.summary ?? { total: 0, approved: 0, expired: 0, amount: 0 };
  const rows = result?.data ?? [];
  const lastPage = result?.meta.lastPage ?? 1;

  return (
    <div className="w-full max-w-full min-w-0 space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">Ventas</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Cotizaciones</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              Propuestas comerciales con productos del catálogo. Una cotización aprobada y vigente se convierte en pedido con los precios cotizados.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => void load(applied, page)} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {permissions.settings ? (
              <Button variant="outline" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="h-4 w-4" />
                Vigencia ({validityDays} d)
              </Button>
            ) : null}
            {permissions.create ? (
              <Link href={`/${tenant}/quotations/new`}>
                <Button>
                  <Plus className="h-4 w-4" />
                  Nueva cotización
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
          <Input
            label="Buscar"
            value={filters.search}
            placeholder="Código, cliente o documento"
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyFilters();
              }
            }}
          />
          <Select
            label="Estado"
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value as Filters["status"] }))}
          >
            {QUOTATION_STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Input label="Desde" type="date" value={filters.fromDate} onChange={(event) => setFilters((prev) => ({ ...prev, fromDate: event.target.value }))} />
          <Input label="Hasta" type="date" value={filters.toDate} onChange={(event) => setFilters((prev) => ({ ...prev, toDate: event.target.value }))} />
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={applyFilters} disabled={loading}>
            <Search className="h-4 w-4" />
            Buscar
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setFilters(emptyFilters);
              setApplied(emptyFilters);
              void load(emptyFilters, 1);
            }}
            disabled={loading}
          >
            Limpiar
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Registros", value: String(summary.total), tone: "text-slate-900 dark:text-white" },
          { label: "Aprobadas", value: String(summary.approved), tone: "text-emerald-700 dark:text-emerald-300" },
          { label: "Vencidas", value: String(summary.expired), tone: "text-slate-500 dark:text-slate-300" },
          { label: "Total cotizado", value: formatQuotationMoney(summary.amount), tone: "text-slate-900 dark:text-white" },
        ].map((card) => (
          <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{card.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${card.tone}`}>{card.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {loading && !result ? (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Cargando cotizaciones...</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-slate-500 dark:text-slate-400">
            <FileText className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-200">No hay cotizaciones con estos filtros</p>
              <p className="text-sm">Crea una cotización para iniciar el flujo comercial.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Código</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Sucursal</th>
                    <th className="px-4 py-3 font-medium">Emisión</th>
                    <th className="px-4 py-3 font-medium">Vigencia</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {rows.map((quotation) => {
                    const validity = validityLabel(quotation);
                    return (
                      <tr key={quotation.id}>
                        <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">{quotation.code}</td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-900 dark:text-white">{quotation.customerName ?? "-"}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{quotation.customerDocument ?? ""}</p>
                        </td>
                        <td className="px-4 py-4 text-slate-700 dark:text-slate-300">{quotation.branchName ?? "-"}</td>
                        <td className="px-4 py-4 text-slate-700 dark:text-slate-300">{formatQuotationDate(quotation.issueDate)}</td>
                        <td className="px-4 py-4 text-slate-700 dark:text-slate-300">
                          {formatQuotationDate(quotation.validUntil)}
                          {validity ? <span className="block text-xs text-slate-500 dark:text-slate-400">{validity}</span> : null}
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-slate-900 dark:text-white">{formatQuotationMoney(quotation.total)}</td>
                        <td className="px-4 py-4">
                          <QuotationStatusBadge status={quotation.effectiveStatus} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-3">
                            <Link href={`/${tenant}/quotations/${quotation.id}`} className="text-sm font-semibold text-blue-700 hover:text-blue-900 dark:text-blue-300">
                              Ver
                            </Link>
                            <button type="button" onClick={() => setPreviewQuotation(quotation)} className="text-sm font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300">
                              PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
              <span>
                Página {page} de {lastPage} · {summary.total} registro(s)
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" disabled={loading || page <= 1} onClick={() => void load(applied, page - 1)}>
                  Anterior
                </Button>
                <Button variant="ghost" size="sm" disabled={loading || page >= lastPage} onClick={() => void load(applied, page + 1)}>
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <PdfPreviewModal
        isOpen={Boolean(previewQuotation)}
        title={previewQuotation ? `Cotización ${previewQuotation.code}` : "Cotización"}
        fileName={previewQuotation ? `cotizacion-${previewQuotation.code}.pdf` : "cotizacion.pdf"}
        description="Vista previa de la cotización"
        allowPrint
        onClose={() => setPreviewQuotation(null)}
        getPdf={() =>
          previewQuotation ? getQuotationPdf(previewQuotation.id) : Promise.reject(new Error("Cotización no seleccionada"))
        }
      />

      {settingsOpen ? (
        <QuotationSettingsDialog
          initialDays={validityDays}
          busy={settingsSaving}
          onCancel={() => setSettingsOpen(false)}
          onSave={(days) => void saveSettings(days)}
        />
      ) : null}

      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}
    </div>
  );
};

export default CotizacionesPage;
