"use client";

import {
  Barcode,
  DollarSign,
  MoreHorizontal,
  Pencil,
  Trash2,
  Warehouse,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ProductResponse } from "../../../domains/products/dtos";

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
}: ProductRowActionsProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const menuItemClass =
    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700";

  return (
    <div className="relative flex items-center justify-end gap-1" ref={rootRef}>
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

      <button
        type="button"
        title="Más acciones"
        aria-label="Más acciones"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[200px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <button
            type="button"
            className={menuItemClass}
            onClick={() => {
              setOpen(false);
              onBarcode(product);
            }}
          >
            <Barcode className="h-4 w-4 shrink-0 text-slate-500" />
            Códigos de barras
          </button>
          {canAdjustStock ? (
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                setOpen(false);
                onAdjustStock(product);
              }}
            >
              <Warehouse className="h-4 w-4 shrink-0 text-slate-500" />
              Ajustar stock
            </button>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                setOpen(false);
                onChangePrice(product);
              }}
            >
              <DollarSign className="h-4 w-4 shrink-0 text-slate-500" />
              Cambiar precio
            </button>
          ) : null}
          {canDelete ? (
            <>
              <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
              <button
                type="button"
                className={`${menuItemClass} text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40`}
                onClick={() => {
                  setOpen(false);
                  onDelete(product);
                }}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                Eliminar
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
