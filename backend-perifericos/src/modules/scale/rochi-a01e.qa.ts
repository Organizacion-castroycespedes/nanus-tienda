import type { RochiA01eParserErrorCode } from "./rochi-a01e.parser";
import type { RochiA01eSerialScale, RochiSerialSnapshot } from "./rochi-a01e.serial";

export type RochiQaErrorRecord = {
  code: RochiA01eParserErrorCode;
  inputHex: string;
  message: string;
  relativeMs: number;
};

export type RochiQaCapture = {
  validFrameCount: number;
  errors: RochiQaErrorRecord[];
  suppressedErrorCount: number;
  snapshot: RochiSerialSnapshot;
};

export type RochiQaCaptureOptions = {
  maxErrors?: number;
  maxInputBytes?: number;
  maxMessageLength?: number;
  startedAtMs?: number;
};

const DEFAULT_MAX_ERRORS = 8;
const DEFAULT_MAX_INPUT_BYTES = 32;
const DEFAULT_MAX_MESSAGE_LENGTH = 160;

export class RochiA01eQaCapture {
  private readonly startedAtMs: number;
  private readonly maxErrors: number;
  private readonly maxInputBytes: number;
  private readonly maxMessageLength: number;
  private validFrameCount = 0;
  private errors: RochiQaErrorRecord[] = [];
  private suppressedErrorCount = 0;

  constructor(
    private readonly scale: RochiA01eSerialScale,
    options: RochiQaCaptureOptions = {}
  ) {
    this.startedAtMs = options.startedAtMs ?? Date.now();
    this.maxErrors = options.maxErrors ?? DEFAULT_MAX_ERRORS;
    this.maxInputBytes = options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES;
    this.maxMessageLength = options.maxMessageLength ?? DEFAULT_MAX_MESSAGE_LENGTH;

    if (!Number.isInteger(this.maxErrors) || this.maxErrors < 1) {
      throw new Error("ROCHI QA maxErrors must be a positive integer");
    }
    if (!Number.isInteger(this.maxInputBytes) || this.maxInputBytes < 1) {
      throw new Error("ROCHI QA maxInputBytes must be a positive integer");
    }
    if (!Number.isInteger(this.maxMessageLength) || this.maxMessageLength < 1) {
      throw new Error("ROCHI QA maxMessageLength must be a positive integer");
    }

    this.scale.onReading(() => {
      this.validFrameCount += 1;
    });
    this.scale.onParseError((error) => {
      if (this.errors.length >= this.maxErrors) {
        this.suppressedErrorCount += 1;
        return;
      }

      this.errors.push({
        code: error.code,
        inputHex: toBoundedHex(error.input, this.maxInputBytes),
        message: error.message.slice(0, this.maxMessageLength),
        relativeMs: Math.max(0, Date.now() - this.startedAtMs),
      });
    });
  }

  finish(): RochiQaCapture {
    return {
      validFrameCount: this.validFrameCount,
      errors: [...this.errors],
      suppressedErrorCount: this.suppressedErrorCount,
      snapshot: this.scale.snapshot(),
    };
  }
}

const toBoundedHex = (input: string | undefined, maxInputBytes: number): string => {
  if (!input) {
    return "";
  }
  return Buffer.from(input, "latin1").subarray(0, maxInputBytes).toString("hex");
};
