"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, XCircle } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { Modal } from "../../../components/design-system/Modal";
import { ApiError } from "../../../lib/request";
import { downloadBlob, getApiErrorMessage } from "../../reporteria/utils";
import {
  commitProductImport,
  downloadProductImportTemplate,
  validateProductImport,
  type ProductImportCommitResult,
  type ProductImportReport,
  type ProductImportRowPlan,
} from "../services/product-import.service";

type Props = {
  onClose: () => void;
  onImported: (result: ProductImportCommitResult) => void;
};

type RowFilter = "ALL" | "ERRORS" | "WARNINGS";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const formatCurrency = (value: number | undefined) =>
  value === undefined
    ? "-"
    : new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 2,
      }).format(value);

const extractReport = (error: unknown): ProductImportReport | null => {
  if (!(error instanceof ApiError)) {
    return null;
  }
  const details = error.details as { report?: ProductImportReport } | undefined;
  return details?.report ?? null;
};

const SummaryCard = ({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "emerald" | "blue" | "rose" | "amber";
}) => {
  const tones: Record<string, string> = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${tones[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
};

const describeClassification = (row: ProductImportRowPlan) => {
  if (!row.category) {
    return row.action === "UPDATE" ? "Sin cambios" : "Sin categoría";
  }
  const category = `${row.category.name}${row.category.isNew ? " (nueva)" : ""}`;
  if (!row.subcategory) {
    return category;
  }
  return `${category} / ${row.subcategory.name}${row.subcategory.isNew ? " (nueva)" : ""}`;
};

const describeTaxes = (row: ProductImportRowPlan) => {
  if (row.taxes === null) {
    return row.action === "UPDATE" ? "Sin cambios" : "-";
  }
  if (row.taxes.length === 0) {
    return "Sin impuestos";
  }
  return row.taxes.map((tax) => tax.name).join(", ");
};

export const ProductImportDialog = ({ onClose, onImported }: Props) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ProductImportReport | null>(null);
  const [ignoredHeaders, setIgnoredHeaders] = useState<string[]>([]);
  const [result, setResult] = useState<ProductImportCommitResult | null>(null);
  const [rowFilter, setRowFilter] = useState<RowFilter>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);

  const visibleRows = useMemo(() => {
    if (!report) {
      return [];
    }
    if (rowFilter === "ERRORS") {
      return report.rows.filter((row) => row.errors.length > 0);
    }
    if (rowFilter === "WARNINGS") {
      return report.rows.filter((row) => row.warnings.length > 0);
    }
    return report.rows;
  }, [report, rowFilter]);

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    setError(null);
    try {
      const blob = await downloadProductImportTemplate();
      downloadBlob(blob, "plantilla_carga_productos.xlsx");
    } catch (downloadError) {
      setError(getApiErrorMessage(downloadError, "No se pudo descargar la plantilla."));
    } finally {
      setDownloading(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setReport(null);
    setResult(null);
    setIgnoredHeaders([]);
    setRowFilter("ALL");
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!selected.name.toLowerCase().endsWith(".xlsx")) {
      setFile(null);
      setError("El archivo debe ser un Excel .xlsx.");
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setFile(null);
      setError("El archivo supera el tamaño máximo de 5 MB.");
      return;
    }
    setFile(selected);
  };

  const handleValidate = async () => {
    if (!file) {
      return;
    }
    setValidating(true);
    setError(null);
    try {
      const validation = await validateProductImport(file);
      setReport(validation.report);
      setIgnoredHeaders(validation.ignoredHeaders);
      setRowFilter(validation.report.summary.withErrors > 0 ? "ERRORS" : "ALL");
    } catch (validateError) {
      setReport(null);
      setError(getApiErrorMessage(validateError, "No se pudo validar el archivo."));
    } finally {
      setValidating(false);
    }
  };

  const handleCommit = async () => {
    if (!file || !report?.canCommit) {
      return;
    }
    setCommitting(true);
    setError(null);
    try {
      const commitResult = await commitProductImport(file);
      setResult(commitResult);
      onImported(commitResult);
    } catch (commitError) {
      const refreshedReport = extractReport(commitError);
      if (refreshedReport) {
        setReport(refreshedReport);
        setRowFilter("ERRORS");
      }
      setError(getApiErrorMessage(commitError, "No se pudo completar la carga."));
    } finally {
      setCommitting(false);
    }
  };

  const resetFile = () => {
    setFile(null);
    setReport(null);
    setResult(null);
    setIgnoredHeaders([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const footer = result ? (
    <>
      <Button variant="ghost" onClick={resetFile}>
        Cargar otro archivo
      </Button>
      <Button onClick={onClose}>Cerrar</Button>
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose} disabled={committing}>
        Cancelar
      </Button>
      <Button
        variant="outline"
        onClick={() => void handleValidate()}
        disabled={!file || committing}
        isLoading={validating}
      >
        {report ? "Validar de nuevo" : "Prevalidar"}
      </Button>
      <Button
        onClick={() => void handleCommit()}
        disabled={!report?.canCommit || validating}
        isLoading={committing}
      >
        Confirmar carga
      </Button>
    </>
  );

  return (
    <Modal
      title="Carga masiva de productos"
      description="Sube un archivo .xlsx con la plantilla. El sistema resuelve unidad, categoría e impuestos antes de guardar."
      size="full"
      responsive
      onClose={committing ? undefined : onClose}
      footer={footer}
    >
      <div className="space-y-5">
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {error}
          </p>
        ) : null}

        {!result ? (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                1. Descarga la plantilla
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Incluye las unidades, IVA, categorías fiscales, categorías y sucursales de tu
                empresa.
              </p>
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => void handleDownloadTemplate()}
                isLoading={downloading}
              >
                <Download className="h-4 w-4" /> Descargar plantilla
              </Button>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                2. Elige el archivo y prevalida
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Máximo 2000 filas y 5 MB. Nada se guarda hasta que confirmes.
              </p>
              <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="truncate">{file ? file.name : "Seleccionar archivo .xlsx"}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={validating || committing}
                />
              </label>
            </div>
          </section>
        ) : null}

        {report && !result ? (
          <section className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              <SummaryCard label="Filas" value={report.summary.total} />
              <SummaryCard label="Crear" value={report.summary.create} tone="emerald" />
              <SummaryCard label="Actualizar" value={report.summary.update} tone="blue" />
              <SummaryCard label="Con stock" value={report.summary.withStock} />
              <SummaryCard label="Errores" value={report.summary.withErrors} tone="rose" />
              <SummaryCard label="Advertencias" value={report.summary.withWarnings} tone="amber" />
            </div>

            {report.canCommit ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Archivo listo. Revisa las advertencias y
                confirma la carga.
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-rose-700">
                <XCircle className="h-4 w-4" /> Corrige las filas con error en el archivo y vuelve a
                prevalidar.
              </p>
            )}

            {report.newCategories.length > 0 || report.newSubcategories.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {report.newCategories.length > 0 ? (
                  <p>
                    Categorías nuevas:{" "}
                    {report.newCategories.map((item) => item.name).join(", ")}
                  </p>
                ) : null}
                {report.newSubcategories.length > 0 ? (
                  <p>
                    Subcategorías nuevas:{" "}
                    {report.newSubcategories
                      .map((item) => `${item.categoryName} / ${item.name}`)
                      .join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}

            {ignoredHeaders.length > 0 ? (
              <p className="text-xs text-slate-500">
                Columnas ignoradas: {ignoredHeaders.join(", ")}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["ALL", `Todas (${report.summary.total})`],
                  ["ERRORS", `Con errores (${report.summary.withErrors})`],
                  ["WARNINGS", `Con advertencias (${report.summary.withWarnings})`],
                ] as Array<[RowFilter, string]>
              ).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={rowFilter === value ? "secondary" : "ghost"}
                  onClick={() => setRowFilter(value)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <div className="max-h-[45vh] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Fila</th>
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2">Acción</th>
                    <th className="px-3 py-2">Unidad</th>
                    <th className="px-3 py-2">Categoría</th>
                    <th className="px-3 py-2">Categoría fiscal</th>
                    <th className="px-3 py-2">Impuestos</th>
                    <th className="px-3 py-2">Precio</th>
                    <th className="px-3 py-2">Stock</th>
                    <th className="px-3 py-2">Mensajes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {visibleRows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={row.errors.length > 0 ? "bg-rose-50/60 dark:bg-rose-950/20" : ""}
                    >
                      <td className="px-3 py-2 text-slate-500">{row.rowNumber}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {row.name || "-"}
                        </p>
                        <p className="text-xs text-slate-500">{row.sku || "Sin SKU"}</p>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            row.action === "CREATE"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {row.action === "CREATE" ? "Crear" : "Actualizar"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{row.unit?.label ?? "-"}</td>
                      <td className="px-3 py-2">{describeClassification(row)}</td>
                      <td className="px-3 py-2">{row.fiscalCategory?.name ?? "-"}</td>
                      <td className="px-3 py-2">{describeTaxes(row)}</td>
                      <td className="px-3 py-2">
                        {formatCurrency(row.product.price)}
                        {row.priceChanged ? (
                          <p className="text-xs text-amber-700">Cambia precio</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        {row.stock ? `${row.stock.quantity} en ${row.stock.branchCode}` : "-"}
                      </td>
                      <td className="px-3 py-2">
                        <ul className="space-y-1">
                          {row.errors.map((message, index) => (
                            <li key={`e-${index}`} className="flex gap-1 text-rose-700">
                              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              {message}
                            </li>
                          ))}
                          {row.warnings.map((message, index) => (
                            <li key={`w-${index}`} className="flex gap-1 text-amber-700">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              {message}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                        No hay filas para este filtro.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {result ? (
          <section className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <SummaryCard label="Filas" value={result.summary.total} />
              <SummaryCard label="Correctas" value={result.summary.succeeded} tone="emerald" />
              <SummaryCard label="Fallidas" value={result.summary.failed} tone="rose" />
              <SummaryCard
                label="Categorías creadas"
                value={result.summary.createdCategories}
                tone="blue"
              />
              <SummaryCard
                label="Subcategorías creadas"
                value={result.summary.createdSubcategories}
                tone="blue"
              />
            </div>
            <div className="max-h-[45vh] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Fila</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Acción</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {result.rows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td className="px-3 py-2 text-slate-500">{row.rowNumber}</td>
                      <td className="px-3 py-2">{row.sku}</td>
                      <td className="px-3 py-2">
                        {row.action === "CREATE" ? "Crear" : "Actualizar"}
                      </td>
                      <td className="px-3 py-2">
                        {row.status === "OK" ? (
                          <span className="text-emerald-700">OK</span>
                        ) : (
                          <span className="text-rose-700">Falló</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{row.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </Modal>
  );
};
