/**
 * Detección de lectores de códigos de barras HID en modo teclado (wedge)
 * para los módulos de Inventario (pedidos y compras).
 *
 * Replica a propósito el algoritmo de referencia del POS
 * (web/modules/pos/utils/pos-scanner-wedge.ts) sin importarlo, para que los
 * cambios en un módulo no afecten al otro (HU-SCAN-001, decisión D1).
 */

export type InventoryBarcodeWedgeState = {
  buffer: string;
  startedAt: number | null;
  lastKeyAt: number | null;
};

export type InventoryBarcodeWedgeOptions = {
  maxKeyGapMs: number;
  maxDurationMs: number;
  minLength: number;
};

export type InventoryBarcodeKeyResult = {
  nextState: InventoryBarcodeWedgeState;
  committedCode: string | null;
  isTerminator: boolean;
};

export const DEFAULT_INVENTORY_BARCODE_WEDGE_OPTIONS: InventoryBarcodeWedgeOptions = {
  maxKeyGapMs: 50,
  maxDurationMs: 750,
  minLength: 8,
};

const TERMINATOR_KEYS = new Set(["Enter", "Return", "CR", "LF", "LineFeed", "\r", "\n"]);

const parsePositiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Usa los mismos ajustes de entorno del lector que el POS: el hardware es el
 * mismo. Se leen de forma literal para que Next.js los incruste en el build.
 */
export const resolveInventoryBarcodeWedgeOptions = (): InventoryBarcodeWedgeOptions => ({
  maxKeyGapMs: parsePositiveNumber(
    process.env.NEXT_PUBLIC_POS_SCANNER_MAX_KEY_GAP_MS,
    DEFAULT_INVENTORY_BARCODE_WEDGE_OPTIONS.maxKeyGapMs
  ),
  maxDurationMs: parsePositiveNumber(
    process.env.NEXT_PUBLIC_POS_SCANNER_MAX_DURATION_MS,
    DEFAULT_INVENTORY_BARCODE_WEDGE_OPTIONS.maxDurationMs
  ),
  minLength: parsePositiveNumber(
    process.env.NEXT_PUBLIC_POS_SCANNER_MIN_LENGTH,
    DEFAULT_INVENTORY_BARCODE_WEDGE_OPTIONS.minLength
  ),
});

export const isInventoryBarcodeTerminatorKey = (key: string) => TERMINATOR_KEYS.has(key);

export const createInventoryBarcodeWedgeState = (): InventoryBarcodeWedgeState => ({
  buffer: "",
  startedAt: null,
  lastKeyAt: null,
});

const captureChar = (
  state: InventoryBarcodeWedgeState,
  key: string,
  timestampMs: number,
  options: InventoryBarcodeWedgeOptions
): InventoryBarcodeWedgeState => {
  if (state.lastKeyAt === null || timestampMs - state.lastKeyAt > options.maxKeyGapMs) {
    return { buffer: key, startedAt: timestampMs, lastKeyAt: timestampMs };
  }

  return {
    buffer: `${state.buffer}${key}`,
    startedAt: state.startedAt ?? timestampMs,
    lastKeyAt: timestampMs,
  };
};

export const shouldCommitInventoryBarcode = (
  state: InventoryBarcodeWedgeState,
  terminatorTimestampMs: number,
  options: InventoryBarcodeWedgeOptions = DEFAULT_INVENTORY_BARCODE_WEDGE_OPTIONS
) => {
  if (state.startedAt === null || state.lastKeyAt === null || !state.buffer) {
    return false;
  }

  return (
    state.buffer.length >= options.minLength &&
    terminatorTimestampMs - state.startedAt <= options.maxDurationMs &&
    terminatorTimestampMs - state.lastKeyAt <= options.maxKeyGapMs
  );
};

/**
 * Procesa una tecla. Devuelve el código leído cuando un terminador cierra una
 * secuencia rápida válida; en cualquier otro caso `committedCode` es null.
 */
export const handleInventoryBarcodeKey = (
  state: InventoryBarcodeWedgeState,
  key: string,
  timestampMs: number,
  options: InventoryBarcodeWedgeOptions = DEFAULT_INVENTORY_BARCODE_WEDGE_OPTIONS
): InventoryBarcodeKeyResult => {
  if (isInventoryBarcodeTerminatorKey(key)) {
    return {
      nextState: createInventoryBarcodeWedgeState(),
      committedCode: shouldCommitInventoryBarcode(state, timestampMs, options)
        ? state.buffer
        : null,
      isTerminator: true,
    };
  }

  if (typeof key !== "string" || key.length !== 1) {
    return { nextState: state, committedCode: null, isTerminator: false };
  }

  return {
    nextState: captureChar(state, key, timestampMs, options),
    committedCode: null,
    isTerminator: false,
  };
};
