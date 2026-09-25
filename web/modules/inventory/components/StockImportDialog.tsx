"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, XCircle } from "lucide-react";
import { listBranches } from "../../../domains/branches/api";
import { Button } from "../../../components/design-system/Button";
import { Modal } from "../../../components/design-system/Modal";
import { Select } from "../../../components/design-system/Select";
import { ApiError } from "../../../lib/request";
import { downloadBlob, getApiErrorMessage } from "../../reporteria/utils";
import {
  commitStockImport,
  downloadStockImportTemplate,
  validateStockImport,
  type StockImportCommitResult,
  type StockImportReport,
  type StockImportRowPlan,
} from "../services/stock-import.service";

type Props = {
  tenantId: string;
  onClose: () => void;
  onImported: (result: StockImportCommitResult) => void;
};

type RowFilter = "ALL" | "CHANGES" | "ERRORS" | "WARNINGS";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const formatQuantity = (value: number) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 4 }).format(value);

const extractReport = (error: unknown): StockImportReport | null => {
  if (!(error instanceof ApiError)) {
    return null;
  }
  const details = error.details as { report?: StockImportReport } | undefined;
  return details?.report ?? null;
};

const SummaryCard = ({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string | number;
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

const actionBadge = (row: Pick<StockImportRowPlan, "action" | "skipped">) => {
  if (row.skipped) {
    return { label: "Omitida", className: "bg-slate-100 text-slate-600" };
  }
  if (row.action === "IN") {
    return { label: "Entrada", className: "bg-emerald-50 text-emerald-700" };
  }
  if (row.action === "OUT") {
    return { label: "Salida", className: "bg-amber-50 text-amber-700" };
  }
  return { label: "Sin cambio", className: "bg-slate-100 text-slate-600" };
};

export const StockImportDialog = ({ tenantId, onClose, onImported }: Props) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [branchId, setBranchId] = useState("");
  const [prefill, setPrefill] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<StockImportReport | null>(null);
  const [ignoredHeaders, setIgnoredHeaders] = useState<string[]>([]);
  const [result, setResult] = useState<StockImportCommitResult | null>(null);
  const [rowFilter, setRowFilter] = useState<RowFilter>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    void listBranches(tenantId ? { tenantId } : {})
      .then((items) => {
        const active = items
          .filter((item) => item.estado === "ACTIVE")
          .map((item) => ({ id: item.id, name: item.nombre }));
        setBranches(active);
        setBranchId((current) => current || active[0]?.id || "");
      })
      .catch(() => setError("No se pudieron cargar las sucursales."));
  }, [tenantId]);

  const visibleRows = useMemo(() => {
    if (!report) {
      return [];
    }
    switch (rowFilter) {
      case "CHANGES":
        return report.rows.filter((row) => row.action !== "NONE");
      case "ERRORS":
        return report.rows.filter((row) => row.errors.length > 0);
      case "WARNINGS":
        return report.rows.filter((row) => row.warnings.length > 0);
      default:
        return report.rows;
    }
  }, [report, rowFilter]);

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    setError(null);
    try {
      const blob = await downloadStockImportTemplate({
        branchId: branchId || undefined,
        prefill,
      });
      downloadBlob(blob, "plantilla_carga_inicial_inventario.xlsx");
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
      setError("El archivo supera el tamaño máximo de 10 MB.");
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
      const validation = await validateStockImport(file);
      setReport(validation.report);
      setIgnoredHeaders(validation.ignoredHeaders);
      setRowFilter(validation.report.summary.withErrors > 0 ? "ERRORS" : "CHANGES");
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
      const commitResult = await commitStockImport(file);
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

  const changes = report ? report.summary.in + report.summary.out : 0;

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
      title="Carga masiva de stock"
      description="La cantidad del archivo es el stock final. El sistema calcula la diferencia y registra entradas o salidas en una sola operación."
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
            <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                1. Descarga la plantilla
              </p>
              <Select
                label="Sucursal"
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
              >
                {branches.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={prefill}
                  onChange={(event) => setPrefill(event.target.checked)}
                />
                Prellenar con los productos y su stock actual (planilla de conteo)
              </label>
              <Button
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
                Máximo 10 000 filas y 10 MB. Nada se guarda hasta que confirmes.
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
              <SummaryCard
                label="Entradas"
                value={`${report.summary.in} (+${formatQuantity(report.summary.quantityIn)})`}
                tone="emerald"
              />
              <SummaryCard
                label="Salidas"
                value={`${report.summary.out} (-${formatQuantity(report.summary.quantityOut)})`}
                tone="amber"
              />
              <SummaryCard label="Sin cambio" value={report.summary.unchanged} />
              <SummaryCard label="Errores" value={report.summary.withErrors} tone="rose" />
              <SummaryCard label="Avisos" value={report.summary.withWarnings} tone="blue" />
            </div>

            {report.canCommit ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {changes > 0
                  ? "Archivo listo. Revisa las salidas y confirma la carga."
                  : "El stock ya coincide con el archivo: no hay movimientos por registrar."}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-rose-700">
                <XCircle className="h-4 w-4" /> Corrige las filas con error en el archivo y vuelve a
                prevalidar.
              </p>
            )}

            {ignoredHeaders.length > 0 ? (
              <p className="text-xs text-slate-500">
                Columnas ignoradas: {ignoredHeaders.join(", ")}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["CHANGES", `Con cambios (${changes})`],
                  ["ERRORS", `Con errores (${report.summary.withErrors})`],
                  ["WARNINGS", `Con avisos (${report.summary.withWarnings})`],
                  ["ALL", `Todas (${report.summary.total})`],
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
                    <th className="px-3 py-2">Sucursal</th>
                    <th className="px-3 py-2">Lote</th>
                    <th className="px-3 py-2 text-right">Antes</th>
                    <th className="px-3 py-2 text-right">Después</th>
                    <th className="px-3 py-2 text-right">Diferencia</th>
                    <th className="px-3 py-2">Acción</th>
                    <th className="px-3 py-2">Mensajes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {visibleRows.map((row) => {
                    const badge = actionBadge(row);
                    return (
                      <tr
                        key={row.rowNumber}
                        className={
                          row.errors.length > 0
                            ? "bg-rose-50/60 dark:bg-rose-950/20"
                            : row.action === "OUT"
                              ? "bg-amber-50/50 dark:bg-amber-950/20"
                              : ""
                        }
                      >
                        <td className="px-3 py-2 text-slate-500">{row.rowNumber}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {row.productName || "-"}
                          </p>
                          <p className="text-xs text-slate-500">{row.sku || "Sin SKU"}</p>
                        </td>
                        <td className="px-3 py-2">{row.branchCode || "-"}</td>
                        <td className="px-3 py-2">
                          {row.lot ? (
                            <>
                              {row.lot.lotCode}
                              {row.lot.isNew ? (
                                <span className="ml-1 text-xs text-blue-700">(nuevo)</span>
                              ) : null}
                              {row.lot.expirationDate ? (
                                <p className="text-xs text-slate-500">
                                  Vence {row.lot.expirationDate}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {row.skipped ? "-" : formatQuantity(row.before)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {row.skipped ? "-" : formatQuantity(row.target)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-medium ${
                            row.delta > 0
                              ? "text-emerald-700"
                              : row.delta < 0
                                ? "text-amber-700"
                                : "text-slate-500"
                          }`}
                        >
                          {row.skipped
                            ? "-"
                            : `${row.delta > 0 ? "+" : ""}${formatQuantity(row.delta)}`}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                          >
                            {badge.label}
                          </span>
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
                    );
                  })}
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
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
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <SummaryCard label="Filas" value={result.summary.total} />
              <SummaryCard
                label="Entradas"
                value={`${result.summary.in} (+${formatQuantity(result.summary.quantityIn)})`}
                tone="emerald"
              />
              <SummaryCard
                label="Salidas"
                value={`${result.summary.out} (-${formatQuantity(result.summary.quantityOut)})`}
                tone="amber"
              />
              <SummaryCard label="Sin cambio" value={result.summary.unchanged} />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {result.referenceId ? (
                <>
                  Carga registrada con referencia{" "}
                  <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-900">
                    {result.referenceId}
                  </code>
                  . Guárdala por si necesitas revertirla.
                </>
              ) : (
                "No se registraron movimientos: el stock ya coincidía con el archivo."
              )}
            </p>
          </section>
        ) : null}
      </div>
    </Modal>
  );
};
