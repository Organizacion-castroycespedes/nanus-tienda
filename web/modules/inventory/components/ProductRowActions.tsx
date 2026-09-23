"use client";

import {
  Barcode,
  DollarSign,
  MoreHorizontal,
  Pencil,
  Trash2,
  Warehouse,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

type MenuPosition = {
  top: number;
  left: number;
  openUpward: boolean;
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
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = () => {
    const button = buttonRef.current;
    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const menuWidth = 208;
    const estimatedMenuHeight = 220;
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < estimatedMenuHeight && rect.top > spaceBelow;
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8,
    );

    setMenuPosition({
      top: openUpward ? rect.top - gap : rect.bottom + gap,
      left,
      openUpward,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleReposition = () => updateMenuPosition();

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

  const menuItemClass =
    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700";

  const menu =
    open && menuPosition && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[80] min-w-[208px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
            style={{
              top: menuPosition.openUpward ? undefined : menuPosition.top,
              bottom: menuPosition.openUpward
                ? window.innerHeight - menuPosition.top
                : undefined,
              left: menuPosition.left,
            }}
          >
            <button
              type="button"
              role="menuitem"
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
                role="menuitem"
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
                role="menuitem"
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
                  role="menuitem"
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
          </div>,
          document.body,
        )
      : null;

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
        ref={buttonRef}
        type="button"
        title="Más acciones"
        aria-label="Más acciones"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {menu}
    </div>
  );
};
