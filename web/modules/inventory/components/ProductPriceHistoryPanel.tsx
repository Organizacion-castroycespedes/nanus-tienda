"use client";

import { useEffect, useState } from "react";
import type {
  ProductPriceHistoryEntry,
  ProductResponse,
} from "../../../domains/products/dtos";
import { getProductPriceHistory } from "../services/product.service";

type ProductPriceHistoryPanelProps = {
  product: ProductResponse;
  reloadKey?: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const statusLabels: Record<ProductPriceHistoryEntry["status"], string> = {
  APPLIED: "Aplicado",
  PENDING_APPROVAL: "Pendiente",
  REJECTED: "Rechazado",
};

const statusStyles: Record<ProductPriceHistoryEntry["status"], string> = {
  APPLIED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PENDING_APPROVAL: "border-amber-200 bg-amber-50 text-amber-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
};

export const ProductPriceHistoryPanel = ({
  product,
  reloadKey = 0,
}: ProductPriceHistoryPanelProps) => {
  const [history, setHistory] = useState<ProductPriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadHistory = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const result = await getProductPriceHistory(product.id);
        if (!mounted) {
          return;
        }
        setHistory(result);
      } catch {
        if (!mounted) {
          return;
        }
        setErrorMessage("No se pudo cargar el historial de precios.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      mounted = false;
    };
  }, [product.id, reloadKey]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Historial de precios
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{product.name}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Precio actual:{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {formatCurrency(Number(product.price))}
            </span>
          </p>
        </div>
        <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          {product.sku}
        </span>
      </div>

      {loading ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
          Cargando historial...
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {!loading && !errorMessage && history.length === 0 ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-300">
          Aun no hay cambios de precio registrados para este producto.
        </div>
      ) : null}

      {!loading && !errorMessage && history.length > 0 ? (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Precio anterior</th>
                <th className="px-4 py-3 font-medium">Precio nuevo</th>
                <th className="px-4 py-3 font-medium">Motivo</th>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    <div className="space-y-1">
                      <p>{formatDateTime(entry.createdAt)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Vigente desde {formatDateTime(entry.validFrom)}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {formatCurrency(Number(entry.previousPrice))}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(Number(entry.newPrice))}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-slate-700 dark:text-slate-200">
                    <span className="line-clamp-3">{entry.reason}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {entry.changedBy ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[entry.status]}`}
                    >
                      {statusLabels[entry.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
};
