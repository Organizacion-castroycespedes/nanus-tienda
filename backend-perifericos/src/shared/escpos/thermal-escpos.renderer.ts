import {
  EscPosMockCommandName,
  type EscPosMockCommand,
} from "../escpos-mock/escpos-mock.types";
import type { CashDrawerPulseProfile } from "../adapters/peripheral-adapter.types";

export type EscPosTextEncoding = "utf8" | "latin1";

export const DEFAULT_CASH_DRAWER_PULSE_PROFILE: CashDrawerPulseProfile = {
  connector: 0,
  pin: 2,
  pulseOnMs: 50,
  pulseOffMs: 250,
};

const normalizeEscPosByte = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const rounded = Math.round(value);
  if (rounded < 0) {
    return 0;
  }
  if (rounded > 255) {
    return 255;
  }

  return rounded;
};

export function buildCashDrawerPulseBytes(
  pulse: CashDrawerPulseProfile = DEFAULT_CASH_DRAWER_PULSE_PROFILE
): Buffer {
  const connector = normalizeEscPosByte(pulse.connector);
  const pulseOnMs = normalizeEscPosByte(pulse.pulseOnMs);
  const pulseOffMs = normalizeEscPosByte(pulse.pulseOffMs);

  return Buffer.from([0x1b, 0x70, connector, pulseOnMs, pulseOffMs]);
}

export function renderCashDrawerPulseEscPos(
  pulse: CashDrawerPulseProfile = DEFAULT_CASH_DRAWER_PULSE_PROFILE
): Buffer {
  return buildCashDrawerPulseBytes(pulse);
}

const commandBytes: Record<EscPosMockCommandName, Buffer> = {
  INIT: Buffer.from([0x1b, 0x40]),
  ALIGN_LEFT: Buffer.from([0x1b, 0x61, 0x00]),
  ALIGN_CENTER: Buffer.from([0x1b, 0x61, 0x01]),
  ALIGN_RIGHT: Buffer.from([0x1b, 0x61, 0x02]),
  BOLD_ON: Buffer.from([0x1b, 0x45, 0x01]),
  BOLD_OFF: Buffer.from([0x1b, 0x45, 0x00]),
  DOUBLE_HEIGHT_ON: Buffer.from([0x1d, 0x21, 0x01]),
  DOUBLE_HEIGHT_OFF: Buffer.from([0x1d, 0x21, 0x00]),
  // ESC d n flushes and advances paper below the footer before GS V cuts.
  FEED: Buffer.from([0x1b, 0x64, 0x06]),
  CUT: Buffer.from([0x1d, 0x56, 0x00]),
  CASH_DRAWER_PULSE: buildCashDrawerPulseBytes(DEFAULT_CASH_DRAWER_PULSE_PROFILE),
  QR_CODE: Buffer.alloc(0),
};

const qrCommand = (command: EscPosMockCommand): Buffer => {
  if (!command.payload) return Buffer.alloc(0);
  const size = Math.min(16, Math.max(1, Math.round(command.size ?? 6)));
  const ec = { L: 48, M: 49, Q: 50, H: 51 }[command.errorCorrection ?? "M"];
  const fn = (data: number[]) => {
    const length = data.length + 3;
    return Buffer.from([0x1d, 0x28, 0x6b, length & 0xff, (length >> 8) & 0xff, ...data]);
  };
  const store = Buffer.from(command.payload, "utf8");
  const storeLength = store.length + 5;
  return Buffer.concat([
    fn([0x31, 0x41, 0x32, 0x00]),
    fn([0x31, 0x43, size]),
    fn([0x31, 0x45, ec]),
    Buffer.from([0x1d, 0x28, 0x6b, storeLength & 0xff, (storeLength >> 8) & 0xff, 0x31, 0x50, 0x30, ...store]),
    fn([0x31, 0x51, 0x30]),
  ]);
};

export const THERMAL_80MM_SAFE_WIDTH_CHARS = 48;

/**
 * Builds the bytes consumed by every real RAW ESC/POS adapter. The preview is
 * already constrained by the profile writer, so adapters never calculate
 * columns, margins or wrapping independently.
 */
export const renderThermalEscPos = (
  commands: EscPosMockCommand[],
  preview: string,
  options: {
    encoding?: EscPosTextEncoding;
    includePhysicalCut: boolean;
  }
): Buffer => {
  const prefix: Buffer[] = [];
  const suffix: Buffer[] = [];

  for (const command of commands) {
    if (command.name === EscPosMockCommandName.Cut && !options.includePhysicalCut) {
      continue;
    }
    const target =
      command.name === EscPosMockCommandName.Feed ||
      command.name === EscPosMockCommandName.Cut
        ? suffix
        : prefix;
    target.push(command.name === EscPosMockCommandName.QrCode ? qrCommand(command) : commandBytes[command.name]);
  }

  return Buffer.concat([
    ...prefix,
    Buffer.from(preview + "\n", options.encoding ?? "latin1"),
    ...suffix,
  ]);
};

export const containsPhysicalCut = (payload: Buffer): boolean =>
  payload.includes(commandBytes[EscPosMockCommandName.Cut]);
