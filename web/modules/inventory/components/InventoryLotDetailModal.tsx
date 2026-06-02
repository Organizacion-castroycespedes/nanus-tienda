"use client";

import { Modal } from "../../../components/design-system/Modal";
import type {
  InventoryLotBalanceResponse,
  InventoryLotResponse,
} from "../services/inventory-lot.service";

export type InventoryLotDetailRow = {
  lot: InventoryLotResponse;
  balance: InventoryLotBalanceResponse | null;
  productName: string;
  branchName: string;
  locationName: string;
  expirationLabel: string;
  expirationTone: string;
  statusLabel: string;
};

type InventoryLotDetailModalProps = {
  row: InventoryLotDetailRow | null;
  onClose: () => void;
  formatDate: (value: string | null | undefined) => string;
  formatNumber: (value: number | null | undefined) => string;
  formatCurrency: (value: number | null | undefined) => string;
};

const DetailItem = ({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 break-words text-sm font-semibold text-slate-900">
      {value ?? "-"}
    </p>
  </div>
);

export const InventoryLotDetailModal = ({
  row,
  onClose,
  formatDate,
  formatNumber,
  formatCurrency,
}: InventoryLotDetailModalProps) => {
  if (!row) {
    return null;
  }

  const { lot, balance } = row;

  return (
    <Modal
      title={`Lote ${lot.lotCode}`}
      description="Consulta read-only de lote, saldo, ubicacion y trazabilidad base."
      onClose={onClose}
      size="xl"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {row.statusLabel}
          </span>
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${row.expirationTone}`}
          >
            {row.expirationLabel}
          </span>
          {lot.isLegacy ? (
            <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
              Legacy
            </span>
          ) : null}
        </div>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DetailItem label="Producto" value={row.productName} />
          <DetailItem label="Sucursal" value={row.branchName} />
          <DetailItem label="Ubicacion" value={row.locationName} />
          <DetailItem label="Vencimiento" value={formatDate(lot.expirationDate)} />
          <DetailItem label="Recibido" value={formatDate(lot.receivedAt)} />
          <DetailItem label="Ultimo movimiento" value={formatDate(balance?.lastMovementAt)} />
          <DetailItem label="En mano" value={formatNumber(balance?.quantityOnHand ?? 0)} />
          <DetailItem label="Reservado" value={formatNumber(balance?.quantityReserved ?? 0)} />
          <DetailItem label="Disponible" value={formatNumber(balance?.quantityAvailable ?? 0)} />
          <DetailItem label="Costo unitario" value={formatCurrency(lot.unitCost)} />
          <DetailItem label="Proveedor" value={lot.supplierId} />
          <DetailItem label="Compra" value={lot.purchaseId} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Trazabilidad tecnica</h3>
          <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
            <span>lotId: {lot.id}</span>
            <span>balanceId: {balance?.id ?? "-"}</span>
            <span>productId: {lot.productId}</span>
            <span>branchId: {lot.branchId}</span>
            <span>locationId: {balance?.locationId ?? "-"}</span>
            <span>purchaseItemId: {lot.purchaseItemId ?? "-"}</span>
          </div>
        </section>
      </div>
    </Modal>
  );
};
