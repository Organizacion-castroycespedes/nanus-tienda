export type PosScannerWedgeState = {
  buffer: string;
  startedAt: number | null;
  lastKeyAt: number | null;
};

export type PosScannerWedgeOptions = {
  maxKeyGapMs?: number;
  maxDurationMs?: number;
  minLength?: number;
};

export const DEFAULT_POS_SCANNER_WEDGE_OPTIONS = {
  maxKeyGapMs: 50,
  maxDurationMs: 750,
  minLength: 8,
} as const;

export const createPosScannerWedgeState = (): PosScannerWedgeState => ({
  buffer: "",
  startedAt: null,
  lastKeyAt: null,
});

export const capturePosScannerWedgeChar = (
  state: PosScannerWedgeState,
  key: string,
  timestampMs: number,
  options: PosScannerWedgeOptions = DEFAULT_POS_SCANNER_WEDGE_OPTIONS
) => {
  if (typeof key !== "string" || key.length !== 1) {
    return state;
  }

  const maxKeyGapMs =
    options.maxKeyGapMs ?? DEFAULT_POS_SCANNER_WEDGE_OPTIONS.maxKeyGapMs;
  const lastKeyAt = state.lastKeyAt;

  if (lastKeyAt === null || timestampMs - lastKeyAt > maxKeyGapMs) {
    return {
      buffer: key,
      startedAt: timestampMs,
      lastKeyAt: timestampMs,
    };
  }

  return {
    buffer: `${state.buffer}${key}`,
    startedAt: state.startedAt ?? timestampMs,
    lastKeyAt: timestampMs,
  };
};

export const shouldCommitPosScannerWedge = (
  state: PosScannerWedgeState,
  terminatorTimestampMs: number,
  options: PosScannerWedgeOptions = DEFAULT_POS_SCANNER_WEDGE_OPTIONS
) => {
  if (state.startedAt === null || state.lastKeyAt === null || !state.buffer) {
    return false;
  }

  const minLength =
    options.minLength ?? DEFAULT_POS_SCANNER_WEDGE_OPTIONS.minLength;
  const maxDurationMs =
    options.maxDurationMs ?? DEFAULT_POS_SCANNER_WEDGE_OPTIONS.maxDurationMs;
  const maxKeyGapMs =
    options.maxKeyGapMs ?? DEFAULT_POS_SCANNER_WEDGE_OPTIONS.maxKeyGapMs;
  const durationMs = terminatorTimestampMs - state.startedAt;
  const tailGapMs = terminatorTimestampMs - state.lastKeyAt;

  return (
    state.buffer.length >= minLength &&
    durationMs <= maxDurationMs &&
    tailGapMs <= maxKeyGapMs
  );
};
