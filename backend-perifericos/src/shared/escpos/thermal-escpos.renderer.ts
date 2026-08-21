import {
  EscPosMockCommandName,
  type EscPosMockCommand,
} from "../escpos-mock/escpos-mock.types";

export type EscPosTextEncoding = "utf8" | "latin1";

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
  CASH_DRAWER_PULSE: Buffer.from([0x1b, 0x70, 0x00, 0x32, 0xfa]),
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
    target.push(commandBytes[command.name]);
  }

  return Buffer.concat([
    ...prefix,
    Buffer.from(preview + "\n", options.encoding ?? "latin1"),
    ...suffix,
  ]);
};

export const containsPhysicalCut = (payload: Buffer): boolean =>
  payload.includes(commandBytes[EscPosMockCommandName.Cut]);
