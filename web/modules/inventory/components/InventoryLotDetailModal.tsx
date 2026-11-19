"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Modal } from "../../../components/design-system/Modal";
import {
  describeLocation,
  describeMovementOrigin,
  describeMovementType,
  signedQuantity,
} from "../lots/lot-traceability";
import {
  getInventoryLotTraceability,
  type InventoryLotBalanceResponse,
  type InventoryLotDiscrepancy,
  type InventoryLotResponse,
  type InventoryLotTraceabilityResponse,
} from "../services/inventory-lot.service";

export type InventoryLotDetailRow = {
  lot: InventoryLotResponse;
  balance: InventoryLotBalanceResponse | null;
  productName: string;
  productSku: string;
  branchName: string;
  locationName: string;
  expirationLabel: string;
  expirationTone: string;
  expirationDays: number | null;
  statusLabel: string;
  supplierName: string | null;
  discrepancies: InventoryLotDiscrepancy[];
};

type InventoryLotDetailModalProps = {
  row: InventoryLotDetailRow | null;
  onClose: () => void;
  formatDate: (value: string | null | undefined) => string;
  formatNumber: (value: number | null | undefined) => string;
  formatCurrency: (value: number | null | undefined) => string;
};

type TraceabilityState =
  | { state: "loading" }
  | { state: "error" }
  | { state: "ready"; data: InventoryLotTraceabilityResponse };

const severityLabels: Record<InventoryLotDiscrepancy["severity"], string> = {
  CRITICAL: "Crítica",
  HIGH: "Alta",
  WARNING: "Advertencia",
  INFO: "Informativa",
};

const severityStyles: Record<InventoryLotDiscrepancy["severity"], string> = {
  CRITICAL: "border-rose-200 bg-rose-50 text-rose-700",
  HIGH: "border-amber-200 bg-amber-50 text-amber-700",
  WARNING: "border-yellow-200 bg-yellow-50 text-yellow-700",
  INFO: "border-blue-200 bg-blue-50 text-blue-700",
};

const thClass = "whitespace-nowrap px-3 py-2 font-medium";
const tdClass = "px-3 py-2 text-slate-700 dark:text-slate-200";
const sectionTitleClass = "mb-2 text-sm font-semibold text-slate-900 dark:text-white";
const emptyClass =
  "rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";

const DetailItem = ({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string | number | null | undefined;
  emphasis?: boolean;
}) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
    <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
    <dd
      className={`mt-1 break-words text-slate-900 dark:text-white ${
        emphasis ? "text-xl font-bold" : "text-sm font-semibold"
      }`}
    >
      {value ?? "-"}
    </dd>
  </div>
);

const describeDays = (days: number | null) => {
  if (days === null) {
    return null;
  }
  if (days < 0) {
    return `venció hace ${Math.abs(days)} día${Math.abs(days) === 1 ? "" : "s"}`;
  }
  if (days === 0) {
    return "vence hoy";
  }
  return `faltan ${days} día${days === 1 ? "" : "s"}`;
};

/**
 * Detalle operativo de lote de solo lectura con ubicaciones, compras y
 * movimientos en el mismo modal (change modernizar-inventario-lotes-ubicaciones, D7 y D14).
 */
export const InventoryLotDetailModal = ({
  row,
  onClose,
  formatDate,
  formatNumber,
  formatCurrency,
}: InventoryLotDetailModalProps) => {
  const lotId = row?.lot.id ?? null;
  const [traceability, setTraceability] = useState<TraceabilityState>({ state: "loading" });

  const loadTraceability = useCallback(async (id: string) => {
    setTraceability({ state: "loading" });
    try {
      const data = await getInventoryLotTraceability(id);
      setTraceability({ state: "ready", data });
    } catch {
      setTraceability({ state: "error" });
    }
  }, []);

  useEffect(() => {
    if (lotId) {
      void loadTraceability(lotId);
    }
  }, [loadTraceability, lotId]);

  if (!row) {
    return null;
  }

  const { lot, balance } = row;
  const daysText = describeDays(row.expirationDays);
  const data = traceability.state === "ready" ? traceability.data : null;

  const renderTraceabilityStatus = (label: string) =>
    traceability.state === "loading" ? (
      <p className={emptyClass} role="status">
        Cargando {label}...
      </p>
    ) : (
      <div className={`${emptyClass} flex flex-wrap items-center justify-between gap-2`} role="status">
        <span>No se pudo cargar {label}.</span>
        <Button variant="ghost" size="sm" onClick={() => void loadTraceability(lot.id)}>
          Reintentar
        </Button>
      </div>
    );

  return (
    <Modal
      title={`Lote ${lot.lotCode}`}
      description={`${row.productName} · SKU ${row.productSku}`}
      onClose={onClose}
      size="xl"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
            Estado: {row.statusLabel}
          </span>
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${row.expirationTone}`}
          >
            {row.expirationLabel}
            {daysText ? ` · ${daysText}` : ""}
          </span>
          {lot.isLegacy ? (
            <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
              Legacy
            </span>
          ) : null}
        </div>

        <section aria-labelledby="lot-detail-stock">
          <h3 id="lot-detail-stock" className={sectionTitleClass}>
            Existencias en {row.locationName}
          </h3>
          {balance ? (
            <dl className="grid gap-3 sm:grid-cols-3">
              <DetailItem label="Disponible" value={formatNumber(balance.quantityAvailable)} emphasis />
              <DetailItem label="Reservado" value={formatNumber(balance.quantityReserved)} />
              <DetailItem label="En mano" value={formatNumber(balance.quantityOnHand)} />
            </dl>
          ) : (
            <p className={emptyClass}>Sin saldo registrado para este lote.</p>
          )}
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DetailItem label="Sucursal" value={row.branchName} />
            <DetailItem label="Vencimiento" value={formatDate(lot.expirationDate)} />
            <DetailItem label="Recibido" value={formatDate(lot.receivedAt)} />
            <DetailItem label="Costo unitario" value={formatCurrency(lot.unitCost)} />
          </dl>
        </section>

        <section aria-labelledby="lot-detail-locations">
          <h3 id="lot-detail-locations" className={sectionTitleClass}>
            Ubicaciones de este lote
          </h3>
          {!data ? (
            renderTraceabilityStatus("las ubicaciones")
          ) : data.locations.length === 0 ? (
            <p className={emptyClass}>Este lote no tiene saldos por ubicación.</p>
          ) : (
            <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                <caption className="sr-only">Saldos del lote por ubicación</caption>
                <thead className="bg-slate-50 text-left text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <tr>
                    <th scope="col" className={thClass}>Ubicación</th>
                    <th scope="col" className={`${thClass} text-right`}>Disponible</th>
                    <th scope="col" className={`${thClass} text-right`}>Reservado</th>
                    <th scope="col" className={`${thClass} text-right`}>En mano</th>
                    <th scope="col" className={thClass}>Últ. mov.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {data.locations.map((location) => {
                    const isCurrent = location.balanceId === balance?.id;
                    return (
                      <tr key={location.balanceId} className={isCurrent ? "bg-blue-50/60 dark:bg-slate-900" : ""}>
                        <td className={tdClass}>
                          {describeLocation(location.locationCode, location.locationName, location.locationIsActive)}
                          {isCurrent ? (
                            <span className="ml-2 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                              Esta fila
                            </span>
                          ) : null}
                        </td>
                        <td className={`${tdClass} text-right font-semibold`}>{formatNumber(location.quantityAvailable)}</td>
                        <td className={`${tdClass} text-right`}>{formatNumber(location.quantityReserved)}</td>
                        <td className={`${tdClass} text-right`}>{formatNumber(location.quantityOnHand)}</td>
                        <td className={`${tdClass} whitespace-nowrap`}>{formatDate(location.lastMovementAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="lot-detail-purchases">
          <h3 id="lot-detail-purchases" className={sectionTitleClass}>
            Compras de este lote
          </h3>
          {!data ? (
            renderTraceabilityStatus("las compras")
          ) : data.purchases.length === 0 ? (
            <p className={emptyClass}>
              Sin compras asociadas. El lote se creó por ajuste o carga de stock
              {row.supplierName ? `; proveedor registrado: ${row.supplierName}` : ""}.
            </p>
          ) : (
            <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                <caption className="sr-only">Compras que alimentaron el lote</caption>
                <thead className="bg-slate-50 text-left text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <tr>
                    <th scope="col" className={thClass}>Recepción</th>
                    <th scope="col" className={thClass}>Proveedor</th>
                    <th scope="col" className={thClass}>Factura</th>
                    <th scope="col" className={`${thClass} text-right`}>Cantidad</th>
                    <th scope="col" className={`${thClass} text-right`}>Costo unitario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {data.purchases.map((purchase) => (
                    <tr key={purchase.purchaseId}>
                      <td className={`${tdClass} whitespace-nowrap`}>
                        {formatDate(purchase.firstReceivedAt)}
                        {purchase.isOrigin ? (
                          <span className="ml-2 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            Origen
                          </span>
                        ) : null}
                      </td>
                      <td className={tdClass}>{purchase.supplierName ?? "Proveedor no disponible"}</td>
                      <td className={tdClass}>
                        {purchase.supplierInvoiceNumber ?? "Sin factura"}
                        {purchase.supplierInvoiceDate ? (
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {formatDate(purchase.supplierInvoiceDate)}
                          </span>
                        ) : null}
                      </td>
                      <td className={`${tdClass} text-right font-semibold`}>{formatNumber(purchase.receivedQuantity)}</td>
                      <td className={`${tdClass} text-right`}>
                        {purchase.unitCost === null ? "-" : formatCurrency(purchase.unitCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="lot-detail-movements">
          <h3 id="lot-detail-movements" className={sectionTitleClass}>
            Movimientos del lote
          </h3>
          {!data ? (
            renderTraceabilityStatus("los movimientos")
          ) : data.movements.length === 0 ? (
            <p className={emptyClass}>Sin movimientos vinculados a este lote.</p>
          ) : (
            <>
              <div className="max-h-72 max-w-full overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                  <caption className="sr-only">Movimientos vinculados al lote, del más reciente al más antiguo</caption>
                  <thead className="sticky top-0 bg-slate-50 text-left text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    <tr>
                      <th scope="col" className={thClass}>Fecha</th>
                      <th scope="col" className={thClass}>Tipo</th>
                      <th scope="col" className={thClass}>Origen</th>
                      <th scope="col" className={thClass}>Ubicación</th>
                      <th scope="col" className={`${thClass} text-right`}>Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {data.movements.map((movement) => {
                      const quantity = signedQuantity(movement.type, movement.quantity);
                      return (
                        <tr key={movement.id}>
                          <td className={`${tdClass} whitespace-nowrap`}>{formatDate(movement.occurredAt)}</td>
                          <td className={tdClass}>{describeMovementType(movement.type)}</td>
                          <td className={tdClass}>
                            {describeMovementOrigin(movement)}
                            {movement.documentLabel ? (
                              <span className="block text-xs text-slate-500 dark:text-slate-400">
                                Factura {movement.documentLabel}
                              </span>
                            ) : null}
                          </td>
                          <td className={tdClass}>{describeLocation(movement.locationCode, movement.locationName)}</td>
                          <td
                            className={`${tdClass} text-right font-semibold ${
                              quantity < 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"
                            }`}
                          >
                            {quantity > 0 ? "+" : ""}
                            {formatNumber(quantity)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {data.movementsTruncated ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Se muestran los {formatNumber(data.movements.length)} movimientos más recientes.
                </p>
              ) : null}
            </>
          )}
        </section>

        <section aria-labelledby="lot-detail-discrepancies">
          <h3 id="lot-detail-discrepancies" className={sectionTitleClass}>
            Discrepancias de conciliación
          </h3>
          {row.discrepancies.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">Sin discrepancias registradas para este lote.</p>
          ) : (
            <ul className="space-y-2">
              {row.discrepancies.map((discrepancy, index) => (
                <li
                  key={`${discrepancy.discrepancyType}-${discrepancy.balanceId ?? discrepancy.stockMovementId ?? index}`}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700"
                >
                  <span
                    className={`mr-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityStyles[discrepancy.severity]}`}
                  >
                    {severityLabels[discrepancy.severity]}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">{discrepancy.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
};
