import { inflateSync } from "node:zlib";
import {
  EscPosMockCommandName,
  type EscPosMockCommand,
} from "../escpos-mock/escpos-mock.types";
import type { CashDrawerPulseProfile } from "../adapters/peripheral-adapter.types";

export type EscPosTextEncoding = "cp858" | "utf8" | "latin1";

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
  IMAGE_RASTER: Buffer.alloc(0),
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
  const storeLength = store.length + 3;
  return Buffer.concat([
    // Alignment is emitted immediately before the native QR sequence. The
    // text renderer may have changed alignment earlier in the ticket.
    commandBytes.ALIGN_CENTER,
    fn([0x31, 0x41, 0x32, 0x00]),
    fn([0x31, 0x43, size]),
    fn([0x31, 0x45, ec]),
    Buffer.from([0x1d, 0x28, 0x6b, storeLength & 0xff, (storeLength >> 8) & 0xff, 0x31, 0x50, 0x30, ...store]),
    fn([0x31, 0x51, 0x30]),
  ]);
};

const rasterCommand = (command: EscPosMockCommand): Buffer => {
  const value = command.payload ?? "";
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/i.exec(value);
  if (!match || match[1].length > 3_000_000) return Buffer.alloc(0);
  try {
    const png = Buffer.from(match[1], "base64");
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (!png.subarray(0, 8).equals(signature)) return Buffer.alloc(0);
    let offset = 8;
    let width = 0;
    let height = 0;
    let colorType = 0;
    const compressed: Buffer[] = [];
    while (offset + 12 <= png.length) {
      const length = png.readUInt32BE(offset);
      const type = png.subarray(offset + 4, offset + 8).toString("ascii");
      const data = png.subarray(offset + 8, offset + 8 + length);
      offset += length + 12;
      if (type === "IHDR") {
        width = data.readUInt32BE(0);
        height = data.readUInt32BE(4);
        if (data[8] !== 8 || ![2, 6].includes(data[9]) || width < 1 || height < 1 || width > 2048 || height > 2048 || width * height > 4_000_000) return Buffer.alloc(0);
        colorType = data[9];
      } else if (type === "IDAT") compressed.push(data);
      else if (type === "IEND") break;
    }
    if (!width || !height || !compressed.length) return Buffer.alloc(0);
    const channels = colorType === 6 ? 4 : 3;
    const stride = width * channels;
    const raw = inflateSync(Buffer.concat(compressed));
    if (raw.length < (stride + 1) * height) return Buffer.alloc(0);
    const rows: Buffer[] = [];
    let cursor = 0;
    for (let y = 0; y < height; y += 1) {
      const filter = raw[cursor++];
      const row = Buffer.from(raw.subarray(cursor, cursor + stride));
      cursor += stride;
      const previous = y ? rows[y - 1] : undefined;
      for (let x = 0; x < stride; x += 1) {
        const left = x >= channels ? row[x - channels] : 0;
        const up = previous?.[x] ?? 0;
        const upLeft = previous && x >= channels ? previous[x - channels] : 0;
        if (filter === 1) row[x] = (row[x] + left) & 255;
        else if (filter === 2) row[x] = (row[x] + up) & 255;
        else if (filter === 3) row[x] = (row[x] + Math.floor((left + up) / 2)) & 255;
        else if (filter === 4) {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
          row[x] = (row[x] + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 255;
        } else if (filter !== 0) return Buffer.alloc(0);
      }
      rows.push(row);
    }
    const targetWidth = Math.min(384, width);
    const targetHeight = Math.max(1, Math.round(height * targetWidth / width));
    const bytesPerRow = Math.ceil(targetWidth / 8);
    const bitmap = Buffer.alloc(bytesPerRow * targetHeight);
    for (let y = 0; y < targetHeight; y += 1) for (let x = 0; x < targetWidth; x += 1) {
      const sx = Math.min(width - 1, Math.floor(x * width / targetWidth));
      const sy = Math.min(height - 1, Math.floor(y * height / targetHeight));
      const i = sx * channels;
      const gray = 0.299 * rows[sy][i] + 0.587 * rows[sy][i + 1] + 0.114 * rows[sy][i + 2];
      if (gray < 180) bitmap[y * bytesPerRow + Math.floor(x / 8)] |= 0x80 >> (x % 8);
    }
    return Buffer.concat([Buffer.from([0x1d, 0x76, 0x30, 0x00, bytesPerRow & 255, bytesPerRow >> 8, targetHeight & 255, targetHeight >> 8]), bitmap]);
  } catch { return Buffer.alloc(0); }
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
  const afterText: Buffer[] = [];
  const suffix: Buffer[] = [];

  for (const command of commands) {
    if (command.name === EscPosMockCommandName.Cut && !options.includePhysicalCut) {
      continue;
    }
    const target = command.name === EscPosMockCommandName.Feed || command.name === EscPosMockCommandName.Cut
      ? suffix
      : command.name === EscPosMockCommandName.QrCode
        ? afterText
        : prefix;
    target.push(
      command.name === EscPosMockCommandName.QrCode
        ? qrCommand(command)
        : command.name === EscPosMockCommandName.ImageRaster
          ? rasterCommand(command)
          : commandBytes[command.name]
    );
  }

  const text = options.encoding === "cp858"
    ? Buffer.concat([Buffer.from([0x1b, 0x74, 19]), encodeCp858(preview + "\n")])
    : Buffer.from(preview + "\n", options.encoding ?? "utf8");
  return Buffer.concat([
    ...prefix,
    text,
    ...afterText,
    ...suffix,
  ]);
};

const CP858_REPLACEMENTS: Record<string, number> = {
  "á": 0xa0, "é": 0x82, "í": 0xa1, "ó": 0xa2, "ú": 0xa3, "ñ": 0xa4, "ü": 0x81,
  "Á": 0xb5, "É": 0x90, "Í": 0xd6, "Ó": 0xe0, "Ú": 0xe9, "Ñ": 0xa5, "Ü": 0x9a,
  "¿": 0xa8, "¡": 0xad,
};

const encodeCp858 = (value: string): Buffer => {
  const bytes: number[] = [];
  for (const character of value) {
    const code = CP858_REPLACEMENTS[character];
    if (code !== undefined) {
      bytes.push(code);
      continue;
    }
    const point = character.codePointAt(0) ?? 0x3f;
    bytes.push(point <= 0x7f ? point : 0x3f);
  }
  return Buffer.from(bytes);
};

export const containsPhysicalCut = (payload: Buffer): boolean =>
  payload.includes(commandBytes[EscPosMockCommandName.Cut]);
