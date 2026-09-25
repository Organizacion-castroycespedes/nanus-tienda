export type RochiA01eUnit = "KG" | "LB";

export type RochiA01eReading = {
  rawValue: string;
  value: number;
  sourceUnit: RochiA01eUnit;
  kilograms: number;
};

export type RochiA01eParserErrorCode =
  | "INVALID_ASCII"
  | "INVALID_FRAME"
  | "BUFFER_OVERFLOW";

export type RochiA01eParserError = {
  code: RochiA01eParserErrorCode;
  input?: string;
  message: string;
};

export type RochiA01eParserOutput = {
  readings: RochiA01eReading[];
  errors: RochiA01eParserError[];
};

export type RochiA01eParserOptions = {
  sourceUnit: RochiA01eUnit;
  maxBufferLength?: number;
};

const ROCHI_FRAME = /^\d{3}\.\d{3}$/;
const DEFAULT_MAX_BUFFER_LENGTH = 128;

/** Parses ROCHI RC-A01E ASCII frames. It does not access a serial port. */
export class RochiA01eParser {
  private buffer = "";
  private readonly sourceUnit: RochiA01eUnit;
  private readonly maxBufferLength: number;

  constructor(options: RochiA01eParserOptions) {
    if (options.sourceUnit !== "KG" && options.sourceUnit !== "LB") {
      throw new Error("ROCHI sourceUnit must be explicitly configured as KG or LB");
    }

    this.sourceUnit = options.sourceUnit;
    this.maxBufferLength = options.maxBufferLength ?? DEFAULT_MAX_BUFFER_LENGTH;

    if (!Number.isInteger(this.maxBufferLength) || this.maxBufferLength < 7) {
      throw new Error("ROCHI maxBufferLength must be an integer of at least 7");
    }
  }

  feed(chunk: string): RochiA01eParserOutput {
    const output: RochiA01eParserOutput = { readings: [], errors: [] };

    if (!isAscii(chunk)) {
      output.errors.push({
        code: "INVALID_ASCII",
        input: chunk,
        message: "ROCHI input must contain ASCII characters only",
      });
      return output;
    }

    this.buffer += chunk;

    if (this.buffer.length > this.maxBufferLength && !this.buffer.includes("\r\n")) {
      output.errors.push({
        code: "BUFFER_OVERFLOW",
        message: "ROCHI incomplete frame exceeded the configured buffer limit",
      });
      this.buffer = "";
      return output;
    }

    let delimiterIndex = this.buffer.indexOf("\r\n");
    while (delimiterIndex >= 0) {
      const frame = this.buffer.slice(0, delimiterIndex);
      this.buffer = this.buffer.slice(delimiterIndex + 2);
      this.parseFrame(frame, output);
      delimiterIndex = this.buffer.indexOf("\r\n");
    }

    if (this.buffer.length > this.maxBufferLength) {
      output.errors.push({
        code: "BUFFER_OVERFLOW",
        message: "ROCHI fragment exceeded the configured buffer limit",
      });
      this.buffer = "";
    }

    return output;
  }

  reset(): void {
    this.buffer = "";
  }

  getPendingFragmentLength(): number {
    return this.buffer.length;
  }

  private parseFrame(frame: string, output: RochiA01eParserOutput): void {
    if (!ROCHI_FRAME.test(frame)) {
      output.errors.push({
        code: "INVALID_FRAME",
        input: frame,
        message: "ROCHI frame must match DDD.DDD exactly",
      });
      return;
    }

    const value = Number(frame);
    const kilograms = this.sourceUnit === "LB" ? value * 0.5 : value;
    output.readings.push({
      rawValue: frame,
      value,
      sourceUnit: this.sourceUnit,
      kilograms,
    });
  }
}

const isAscii = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 0x7f) {
      return false;
    }
  }
  return true;
};
