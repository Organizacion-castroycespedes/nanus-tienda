import { normalizeInventoryBarcode } from "./barcode-resolver";

/** Ventana de doble escaneo para pedidos y compras (HU-SCAN-001, D4). */
export const INVENTORY_BARCODE_DEDUPE_WINDOW_MS = 300;

export type InventoryBarcodeDeduper = {
  /** true si la lectura debe procesarse; false si es un rebote del mismo código. */
  shouldProcess: (code: string, timestampMs: number) => boolean;
  reset: () => void;
};

/**
 * La ventana es deslizante: cada lectura repetida del mismo código dentro de
 * la ventana la extiende, de modo que una ráfaga de rebotes cuenta una sola vez.
 */
export const createInventoryBarcodeDeduper = (
  windowMs: number = INVENTORY_BARCODE_DEDUPE_WINDOW_MS
): InventoryBarcodeDeduper => {
  let last: { code: string; at: number } | null = null;

  return {
    shouldProcess: (rawCode, timestampMs) => {
      const code = normalizeInventoryBarcode(rawCode);
      if (!code) {
        return false;
      }

      const isRepeat = last !== null && last.code === code && timestampMs - last.at < windowMs;
      last = { code, at: timestampMs };
      return !isRepeat;
    },
    reset: () => {
      last = null;
    },
  };
};
