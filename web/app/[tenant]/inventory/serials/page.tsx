"use client";

import { History, MapPin, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { Button } from "../../../../components/design-system/Button";
import { Input } from "../../../../components/design-system/Input";
import { Select } from "../../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../../components/design-system/Toast";
import { listBranches } from "../../../../domains/branches/api";
import type { BranchResponse } from "../../../../domains/branches/dtos";
import { useInventoryScope } from "../../../../hooks/useInventoryScope";
import { hasMenuAccess } from "../../../../lib/permissions";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import {
  searchSerials,
  type ProductSerialDetail,
  type ProductSerialStatus,
} from "../../../../modules/inventory/services/product-serial.service";
import { SerialHistoryModal, SerialInspectDialog, SerialMoveDialog } from "../../../../modules/inventory/serials/SerialDialogs";
import {
  allowedInspectionResults,
  canMoveSerial,
  SERIAL_STATUS_LABELS,
  SERIAL_STATUS_STYLES,
} from "../../../../modules/inventory/serials/serial-labels";

const PAGE_SIZE = 50;

type Filters = { search: string; status: ProductSerialStatus | ""; branchId: string };

const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat("es-CO", { dateStyle: "short" }).format(new Date(value)) : "-";

const InventorySerialsPage = () => {
  const { currentTenant, isSuperRole } = useInventoryScope();
  const canWrite = hasMenuAccess("INVENTORY_SERIALS", "WRITE");
  const [draft, setDraft] = useState<Filters>({ search: "", status: "", branchId: "" });
  const [filters, setFilters] = useState<Filters>({ search: "", status: "", branchId: "" });
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<ProductSerialDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingInspection, setPendingInspection] = useState<number | null>(null);
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [inspectTarget, setInspectTarget] = useState<ProductSerialDetail | null>(null);
  const [moveTargets, setMoveTargets] = useState<ProductSerialDetail[] | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useAutoClearState(toastMessage, setToastMessage);

  useEffect(() => {
    let mounted = true;
    listBranches(isSuperRole && currentTenant ? { tenantId: currentTenant } : {})
      .then((result) => mounted && setBranches(result))
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [currentTenant, isSuperRole]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, pending] = await Promise.all([
        searchSerials({
          search: filters.search,
          status: filters.status,
          branchId: filters.branchId || undefined,
          limit: PAGE_SIZE,
          offset,
        }),
        searchSerials({ status: "RETURNED", branchId: filters.branchId || undefined, limit: 1 }),
      ]);
      setItems(result.items);
      setTotal(result.total);
      setPendingInspection(pending.total);
      setSelectedIds(new Set());
    } catch (loadError) {
      setError(
        loadError && typeof loadError === "object" && "message" in loadError && typeof loadError.message === "string"
          ? loadError.message
          : "No se pudieron cargar las series."
      );
    } finally {
      setLoading(false);
    }
  }, [filters, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const notify = (message: string, variant: ToastVariant = "success") => {
    setToast({ message, variant });
    setToastMessage(message);
  };

  const applyFilters = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setOffset(0);
    setFilters({ ...draft });
  };

  const selectedSerials = useMemo(() => items.filter((item) => selectedIds.has(item.id)), [items, selectedIds]);
  const movableItems = items.filter((item) => canMoveSerial(item.status));
  const allMovableSelected = movableItems.length > 0 && movableItems.every((item) => selectedIds.has(item.id));

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const done = (message: string) => {
    setInspectTarget(null);
    setMoveTargets(null);
    notify(message);
    void load();
  };

  const pageEnd = Math.min(offset + items.length, total);

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-xs uppercase tracking-wide text-slate-500">Inventario</p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Series</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Busca una serie, revisa su historial, inspecciona las devueltas y cambia su ubicación.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Actualizar
          </Button>
        </div>
        {pendingInspection ? (
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800"
            onClick={() => {
              const next = { ...draft, status: "RETURNED" as const };
              setDraft(next);
              setOffset(0);
              setFilters(next);
            }}
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {pendingInspection} {pendingInspection === 1 ? "serie devuelta pendiente" : "series devueltas pendientes"} de
            inspección
          </button>
        ) : null}
      </section>

      <form
        onSubmit={applyFilters}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end sm:p-6 dark:border-slate-700 dark:bg-slate-800"
      >
        <Input
          label="Buscar"
          placeholder="Serie, producto o SKU"
          value={draft.search}
          onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))}
        />
        <Select
          label="Estado"
          value={draft.status}
          onChange={(event) =>
            setDraft((current) => ({ ...current, status: event.target.value as ProductSerialStatus | "" }))
          }
        >
          <option value="">Todos</option>
          {(Object.keys(SERIAL_STATUS_LABELS) as ProductSerialStatus[]).map((status) => (
            <option key={status} value={status}>
              {SERIAL_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
        <Select
          label="Sucursal"
          value={draft.branchId}
          onChange={(event) => setDraft((current) => ({ ...current, branchId: event.target.value }))}
        >
          <option value="">Todas las permitidas</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.nombre}
            </option>
          ))}
        </Select>
        <Button type="submit" disabled={loading}>
          <Search className="h-4 w-4" aria-hidden="true" />
          Buscar
        </Button>
      </form>

      {toast && toastMessage ? <Toast message={toast.message} variant={toast.variant} /> : null}
      {error ? (
        <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {total === 0 ? "Sin resultados" : `${offset + 1}–${pageEnd} de ${total} series`}
          </p>
          {canWrite && selectedSerials.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => setMoveTargets(selectedSerials)}>
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Mover ubicación ({selectedSerials.length})
            </Button>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] divide-y divide-slate-200 text-sm">
            <thead className="text-left text-slate-600 dark:text-slate-300">
              <tr>
                {canWrite ? (
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar las series en existencia"
                      checked={allMovableSelected}
                      onChange={() =>
                        setSelectedIds(allMovableSelected ? new Set() : new Set(movableItems.map((item) => item.id)))
                      }
                    />
                  </th>
                ) : null}
                <th className="px-3 py-2 font-medium">Serie</th>
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Sucursal</th>
                <th className="px-3 py-2 font-medium">Ubicación</th>
                <th className="px-3 py-2 font-medium">Recibida</th>
                <th className="px-3 py-2 font-medium">Vendida</th>
                <th className="px-3 py-2 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const status = item.status as ProductSerialStatus;
                return (
                  <tr key={item.id}>
                    {canWrite ? (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar ${item.serialNumber}`}
                          disabled={!canMoveSerial(item.status)}
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelected(item.id)}
                        />
                      </td>
                    ) : null}
                    <td className="px-3 py-2 font-mono text-slate-900 dark:text-white">{item.serialNumber}</td>
                    <td className="px-3 py-2">
                      <p className="text-slate-900 dark:text-white">{item.productName}</p>
                      <p className="text-xs text-slate-500">{item.productSku}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          SERIAL_STATUS_STYLES[status] ?? ""
                        }`}
                      >
                        {SERIAL_STATUS_LABELS[status] ?? item.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{item.branchName ?? "-"}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                      {item.locationCode ? `${item.locationCode} - ${item.locationName ?? ""}` : "Sin ubicación"}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{formatDate(item.receivedAt)}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{formatDate(item.soldAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="ghost" size="sm" onClick={() => setHistoryId(item.id)}>
                          <History className="h-4 w-4" aria-hidden="true" />
                          Historial
                        </Button>
                        {canWrite && allowedInspectionResults(item.status).length > 0 ? (
                          <Button variant="outline" size="sm" onClick={() => setInspectTarget(item)}>
                            {item.status === "AVAILABLE" ? "Bloquear" : "Inspeccionar"}
                          </Button>
                        ) : null}
                        {canWrite && canMoveSerial(item.status) ? (
                          <Button variant="outline" size="sm" onClick={() => setMoveTargets([item])}>
                            Mover
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={canWrite ? 9 : 8} className="px-3 py-6 text-center text-sm text-slate-500">
                    No hay series con estos filtros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || offset === 0}
            onClick={() => setOffset((current) => Math.max(current - PAGE_SIZE, 0))}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || offset + PAGE_SIZE >= total}
            onClick={() => setOffset((current) => current + PAGE_SIZE)}
          >
            Siguiente
          </Button>
        </div>
      </section>

      {historyId ? <SerialHistoryModal serialId={historyId} onClose={() => setHistoryId(null)} /> : null}
      {inspectTarget ? (
        <SerialInspectDialog serial={inspectTarget} onClose={() => setInspectTarget(null)} onDone={done} />
      ) : null}
      {moveTargets ? (
        <SerialMoveDialog serials={moveTargets} onClose={() => setMoveTargets(null)} onDone={done} />
      ) : null}
    </div>
  );
};

export default InventorySerialsPage;
