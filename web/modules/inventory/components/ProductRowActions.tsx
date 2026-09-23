"use client";

import { Barcode, DollarSign, Pencil, Trash2, Warehouse } from "lucide-react";
import type { ProductResponse } from "../../../domains/products/dtos";
import { RowActionsMenu } from "../../../components/design-system/RowActionsMenu";

type ProductRowActionsProps = {
  product: ProductResponse;
  canEdit: boolean;
  canDelete: boolean;
  canAdjustStock: boolean;
  onBarcode: (product: ProductResponse) => void;
  onAdjustStock: (product: ProductResponse) => void;
  onChangePrice: (product: ProductResponse) => void;
  onEdit: (product: ProductResponse) => void;
  onDelete: (product: ProductResponse) => void;
};

export const ProductRowActions = ({
  product,
  canEdit,
  canDelete,
  canAdjustStock,
  onBarcode,
  onAdjustStock,
  onChangePrice,
  onEdit,
  onDelete,
}: ProductRowActionsProps) => (
  <div className="relative flex items-center justify-end gap-1">
    {canEdit ? (
      <button
        type="button"
        title="Editar producto"
        aria-label="Editar producto"
        onClick={() => onEdit(product)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-slate-600 transition hover:border-slate-200 hover:bg-slate-50 hover:text-blue-600 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
      >
        <Pencil className="h-4 w-4" />
      </button>
    ) : null}
    <RowActionsMenu
      items={[
        { label: "Códigos de barras", icon: <Barcode className="h-4 w-4 text-slate-500" />, onSelect: () => onBarcode(product) },
        ...(canAdjustStock ? [{ label: "Ajustar stock", icon: <Warehouse className="h-4 w-4 text-slate-500" />, onSelect: () => onAdjustStock(product) }] : []),
        ...(canEdit ? [{ label: "Cambiar precio", icon: <DollarSign className="h-4 w-4 text-slate-500" />, onSelect: () => onChangePrice(product) }] : []),
        ...(canDelete ? [{ label: "Eliminar", icon: <Trash2 className="h-4 w-4" />, onSelect: () => onDelete(product), destructive: true, separatorBefore: true }] : []),
      ]}
    />
  </div>
);
