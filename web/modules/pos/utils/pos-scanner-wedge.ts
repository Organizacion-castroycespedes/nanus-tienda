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

export type PosScannerKeyboardEventResult = {
  nextState: PosScannerWedgeState;
  committedCode: string | null;
};

export const DEFAULT_POS_SCANNER_WEDGE_OPTIONS = {
  maxKeyGapMs: 50,
  maxDurationMs: 750,
  minLength: 8,
} as const;

const POS_SCANNER_TERMINATOR_KEYS = new Set([
  "Enter",
  "Return",
  "CR",
  "LF",
  "LineFeed",
  "\r",
  "\n",
]);

const parseScannerTimingOption = (value: string | null | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const resolvePosScannerWedgeOptions = (): PosScannerWedgeOptions => ({
  maxKeyGapMs: parseScannerTimingOption(
    process.env.NEXT_PUBLIC_POS_SCANNER_MAX_KEY_GAP_MS,
    DEFAULT_POS_SCANNER_WEDGE_OPTIONS.maxKeyGapMs
  ),
  maxDurationMs: parseScannerTimingOption(
    process.env.NEXT_PUBLIC_POS_SCANNER_MAX_DURATION_MS,
    DEFAULT_POS_SCANNER_WEDGE_OPTIONS.maxDurationMs
  ),
  minLength: parseScannerTimingOption(
    process.env.NEXT_PUBLIC_POS_SCANNER_MIN_LENGTH,
    DEFAULT_POS_SCANNER_WEDGE_OPTIONS.minLength
  ),
});

export const isPosScannerTerminatorKey = (key: string) => POS_SCANNER_TERMINATOR_KEYS.has(key);

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

export const handlePosScannerKeyboardEvent = (
  state: PosScannerWedgeState,
  key: string,
  timestampMs: number,
  scannerEnabled: boolean,
  options: PosScannerWedgeOptions = DEFAULT_POS_SCANNER_WEDGE_OPTIONS
): PosScannerKeyboardEventResult => {
  if (!scannerEnabled) {
    return {
      nextState: state,
      committedCode: null,
    };
  }

  if (isPosScannerTerminatorKey(key)) {
    return {
      nextState: createPosScannerWedgeState(),
      committedCode: shouldCommitPosScannerWedge(state, timestampMs, options)
        ? state.buffer
        : null,
    };
  }

  if (key.length !== 1) {
    return {
      nextState: state,
      committedCode: null,
    };
  }

  return {
    nextState: capturePosScannerWedgeChar(state, key, timestampMs, options),
    committedCode: null,
  };
};
