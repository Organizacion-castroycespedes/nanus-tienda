"use client";

import { useEffect, useRef, useState } from "react";
import {
  previewOrderLinePrice,
  type OrderLinePricePreview,
} from "../../inventory/order-capture/order-pricing-preview";

export type QuotationDraftLine = {
  /** Id local estable para React (no se envia a la API). */
  key: string;
  productId: string;
  productName: string;
  productCode: string | null;
  unitCode: string | null;
  allowsDecimal: boolean;
  quantity: number;
  /** Precio de lista del catalogo; respaldo mientras llega el precio del motor. */
  listPrice: number;
  /** Valores guardados en la cotizacion (solo lectura o recien cargada). */
  saved?: {
    finalUnitPrice: number;
    discountPercent: number;
    promotionName: string | null;
    taxRate: number;
    taxAmount: number;
    lineTotal: number;
  };
};

export type QuotationLinePricing =
  | { status: "loading" }
  | { status: "ready"; preview: OrderLinePricePreview }
  | { status: "error"; message: string };

const DEBOUNCE_MS = 350;

/**
 * Precio informativo por linea con el mismo motor que usa la API al guardar
 * (POST /pricing/preview-line, canal ORDER). El servidor vuelve a calcular al guardar.
 */
export const useQuotationLinePricing = (input: {
  lines: readonly QuotationDraftLine[];
  branchId: string;
  customerId: string;
  enabled: boolean;
}) => {
  const { lines, branchId, customerId, enabled } = input;
  const [pricing, setPricing] = useState<Record<string, QuotationLinePricing>>({});
  const requested = useRef<Record<string, string>>({});
  const signature = lines.map((line) => `${line.key}:${line.productId}:${line.quantity}`).join("|");

  useEffect(() => {
    if (!enabled || !branchId) {
      return undefined;
    }
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    for (const line of lines) {
      if (!(line.quantity > 0)) {
        continue;
      }
      const requestKey = `${branchId}|${customerId}|${line.productId}|${line.quantity}`;
      if (requested.current[line.key] === requestKey) {
        continue;
      }
      requested.current[line.key] = requestKey;
      setPricing((prev) => ({ ...prev, [line.key]: { status: "loading" } }));
      timers.push(
        setTimeout(() => {
          previewOrderLinePrice({
            branchId,
            productId: line.productId,
            quantity: line.quantity,
            channel: "ORDER",
            customerId: customerId || undefined,
          })
            .then((preview) => {
              if (requested.current[line.key] === requestKey) {
                setPricing((prev) => ({ ...prev, [line.key]: { status: "ready", preview } }));
              }
            })
            .catch((error: unknown) => {
              if (requested.current[line.key] === requestKey) {
                setPricing((prev) => ({
                  ...prev,
                  [line.key]: {
                    status: "error",
                    message: error instanceof Error ? error.message : "No se pudo calcular el precio.",
                  },
                }));
              }
            });
        }, DEBOUNCE_MS)
      );
    }
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
    // signature resume productos y cantidades; evita recalcular por identidad del arreglo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, customerId, enabled, signature]);

  return pricing;
};

export type QuotationLineAmounts = {
  unitPrice: number;
  discountPercent: number;
  promotionName: string | null;
  taxAmount: number;
  lineTotal: number;
  pending: boolean;
};

/** Valores a mostrar: guardados (solo lectura), del motor (editable) o de lista mientras carga. */
export const resolveLineAmounts = (
  line: QuotationDraftLine,
  pricing: QuotationLinePricing | undefined,
  readOnly: boolean
): QuotationLineAmounts => {
  if (readOnly && line.saved) {
    return {
      unitPrice: line.saved.finalUnitPrice,
      discountPercent: line.saved.discountPercent,
      promotionName: line.saved.promotionName,
      taxAmount: line.saved.taxAmount,
      lineTotal: line.saved.lineTotal,
      pending: false,
    };
  }
  if (pricing?.status === "ready") {
    return {
      unitPrice: pricing.preview.finalUnitPrice,
      discountPercent: pricing.preview.discountPercent,
      promotionName: pricing.preview.appliedPromotionName,
      taxAmount: pricing.preview.taxAmount,
      lineTotal: pricing.preview.lineTotal,
      pending: false,
    };
  }
  return {
    unitPrice: line.listPrice,
    discountPercent: 0,
    promotionName: null,
    taxAmount: 0,
    lineTotal: Math.round(line.listPrice * line.quantity * 100) / 100,
    pending: true,
  };
};
