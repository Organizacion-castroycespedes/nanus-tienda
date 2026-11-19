import { useEffect, useRef, useState } from "react";

import { ApiError } from "../../../lib/request";
import {
  buildOrderLinePricingKey,
  type OrderCaptureLine,
  type OrderLinePricingState,
} from "./order-capture-lines";
import { previewOrderLinePrice } from "./order-pricing-preview";

const PRICING_DEBOUNCE_MS = 350;

const isNetworkError = (error: unknown) =>
  (typeof navigator !== "undefined" && !navigator.onLine) ||
  (error instanceof TypeError && error.message.toLowerCase().includes("fetch"));

/**
 * Pide al backend el precio informativo de cada línea (canal ORDER) con
 * debounce. Si el backend responde 403 deja de consultar y marca las líneas
 * como "sin permiso"; el formulario usa entonces el precio de lista (D6).
 */
export const useOrderLinePricing = (input: {
  lines: readonly OrderCaptureLine[];
  branchId: string;
  customerId: string;
  enabled: boolean;
}) => {
  const { lines, branchId, customerId, enabled } = input;
  const [pricing, setPricing] = useState<Record<string, OrderLinePricingState>>({});
  const [forbidden, setForbidden] = useState(false);
  const pricingRef = useRef(pricing);
  pricingRef.current = pricing;
  const forbiddenRef = useRef(forbidden);
  forbiddenRef.current = forbidden;

  const linesSignature = lines.map((line) => `${line.productId}:${line.quantity}`).join(",");

  useEffect(() => {
    if (!enabled || !branchId) {
      return undefined;
    }

    const timers: Array<ReturnType<typeof setTimeout>> = [];
    for (const line of lines) {
      const key = buildOrderLinePricingKey({
        branchId,
        customerId,
        productId: line.productId,
        quantity: line.quantity,
      });
      const current = pricingRef.current[line.productId];
      // "loading" se reprograma: su temporizador pudo cancelarse en una ejecución previa.
      if (current?.key === key && current.status !== "pending" && current.status !== "loading") {
        continue;
      }
      if (forbiddenRef.current) {
        setPricing((prev) => ({ ...prev, [line.productId]: { status: "forbidden", key } }));
        continue;
      }

      if (current?.key !== key || current.status !== "loading") {
        setPricing((prev) => ({ ...prev, [line.productId]: { status: "loading", key } }));
      }
      timers.push(
        setTimeout(() => {
          void previewOrderLinePrice({
            branchId,
            productId: line.productId,
            quantity: line.quantity,
            channel: "ORDER",
            customerId: customerId || undefined,
          })
            .then((preview) => {
              setPricing((prev) =>
                prev[line.productId]?.key === key
                  ? { ...prev, [line.productId]: { status: "ready", key, preview } }
                  : prev
              );
            })
            .catch((error: unknown) => {
              let next: OrderLinePricingState;
              if (error instanceof ApiError && error.status === 403) {
                setForbidden(true);
                next = { status: "forbidden", key };
              } else if (isNetworkError(error)) {
                next = { status: "pending", key };
              } else {
                next = {
                  status: "error",
                  key,
                  message: error instanceof Error ? error.message : "No se pudo calcular el precio.",
                };
              }
              setPricing((prev) =>
                prev[line.productId]?.key === key ? { ...prev, [line.productId]: next } : prev
              );
            });
        }, PRICING_DEBOUNCE_MS)
      );
    }

    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
    // linesSignature resume cantidades y productos; evita recalcular por identidad del arreglo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, customerId, enabled, linesSignature]);

  return { pricing, forbidden };
};
