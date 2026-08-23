import type { PosScannerWedgeOptions, PosScannerWedgeState } from "./pos-scanner-wedge";
import { DEFAULT_POS_SCANNER_WEDGE_OPTIONS } from "./pos-scanner-wedge";

export type PosScannerHidStatus = {
  label: string;
  detail: string | null;
  tone: string;
};

export type PosScannerWedgeIgnoredSequence = {
  reason: string;
  length: number;
  durationMs: number;
};

export type PosScannerHidLogger = {
  captureEnabled: () => void;
  scanDetected: (input: { code: string; length: number; durationMs: number }) => void;
  processingCode: (code: string) => void;
  productMatched: (input: { id: string; name: string }) => void;
  productNotFound: (code: string) => void;
  sequenceIgnored: (input: PosScannerWedgeIgnoredSequence) => void;
};

const POS_SCANNER_HID_LOG_PREFIX = "[POS Scanner HID]";

const buildLogger = (
  enabled: boolean,
  sink: Pick<Console, "info">
): PosScannerHidLogger => {
  const emit = (message: string, payload?: Record<string, unknown>) => {
    if (!enabled) {
      return;
    }

    if (payload) {
      sink.info(message, payload);
      return;
    }

    sink.info(message);
  };

  return {
    captureEnabled: () => emit(`${POS_SCANNER_HID_LOG_PREFIX} capture enabled`),
    scanDetected: ({ code, length, durationMs }) =>
      emit(`${POS_SCANNER_HID_LOG_PREFIX} scan detected`, {
        code,
        length,
        durationMs,
      }),
    processingCode: (code) =>
      emit(`${POS_SCANNER_HID_LOG_PREFIX} processing code`, {
        code,
      }),
    productMatched: ({ id, name }) =>
      emit(`${POS_SCANNER_HID_LOG_PREFIX} product matched`, {
        id,
        name,
      }),
    productNotFound: (code) =>
      emit(`${POS_SCANNER_HID_LOG_PREFIX} product not found`, {
        code,
      }),
    sequenceIgnored: (input) =>
      emit(`${POS_SCANNER_HID_LOG_PREFIX} sequence ignored`, input),
  };
};

export const createPosScannerHidLogger = (
  enabled: boolean,
  sink: Pick<Console, "info"> = console
) => buildLogger(enabled, sink);

export const resolvePosScannerHidStatus = (
  scannerEnabled: boolean,
  lastReadCode: string | null
): PosScannerHidStatus => ({
  label: scannerEnabled ? "Scanner HID habilitado" : "Scanner HID deshabilitado",
  detail: scannerEnabled && lastReadCode ? "Última lectura OK" : null,
  tone: scannerEnabled
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
    : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300",
});

const resolveWedgeTiming = (
  state: PosScannerWedgeState,
  terminatorTimestampMs: number
) => {
  if (state.startedAt === null || state.lastKeyAt === null || !state.buffer) {
    return {
      durationMs: 0,
      tailGapMs: 0,
    };
  }

  return {
    durationMs: Math.max(0, terminatorTimestampMs - state.startedAt),
    tailGapMs: Math.max(0, terminatorTimestampMs - state.lastKeyAt),
  };
};

export const describePosScannerWedgeIgnoredSequence = (
  state: PosScannerWedgeState,
  terminatorTimestampMs: number,
  options: PosScannerWedgeOptions = DEFAULT_POS_SCANNER_WEDGE_OPTIONS
) => {
  if (state.startedAt === null || state.lastKeyAt === null || !state.buffer) {
    return null;
  }

  const maxKeyGapMs =
    options.maxKeyGapMs ?? DEFAULT_POS_SCANNER_WEDGE_OPTIONS.maxKeyGapMs;
  const maxDurationMs =
    options.maxDurationMs ?? DEFAULT_POS_SCANNER_WEDGE_OPTIONS.maxDurationMs;
  const minLength = options.minLength ?? DEFAULT_POS_SCANNER_WEDGE_OPTIONS.minLength;
  const { durationMs, tailGapMs } = resolveWedgeTiming(
    state,
    terminatorTimestampMs
  );

  if (state.buffer.length < minLength) {
    return {
      reason: "length below minimum",
      length: state.buffer.length,
      durationMs,
    };
  }

  if (durationMs > maxDurationMs) {
    return {
      reason: "duration above maximum",
      length: state.buffer.length,
      durationMs,
    };
  }

  if (tailGapMs > maxKeyGapMs) {
    return {
      reason: "tail gap above maximum",
      length: state.buffer.length,
      durationMs,
    };
  }

  return null;
};
