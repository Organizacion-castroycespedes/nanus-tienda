import type {
  RochiA01eParserError,
  RochiA01eReading,
  RochiA01eUnit,
} from "./rochi-a01e.parser";
import { RochiA01eParser } from "./rochi-a01e.parser";

export type RochiSerialParity = "none" | "even" | "odd";

export type RochiSerialConfig = {
  path: string;
  sourceUnit: RochiA01eUnit;
  baudRate?: number;
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 2;
  parity?: RochiSerialParity;
  rtscts?: boolean;
  maxBufferLength?: number;
  maxReadingAgeMs?: number;
};

export type RochiSerialPortOptions = {
  path: string;
  baudRate: number;
  dataBits: 5 | 6 | 7 | 8;
  stopBits: 1 | 2;
  parity: RochiSerialParity;
  rtscts: boolean;
  autoOpen: false;
};

export type RochiSerialPort = {
  isOpen?: boolean;
  on(event: "data", listener: (data: Buffer) => void): RochiSerialPort;
  on(event: "error", listener: (error: Error) => void): RochiSerialPort;
  on(event: "close", listener: () => void): RochiSerialPort;
  open(callback: (error?: Error | null) => void): void;
  close(callback: (error?: Error | null) => void): void;
};

export type RochiSerialPortFactory = (
  options: RochiSerialPortOptions
) => RochiSerialPort;

export type RochiMeasurement = RochiA01eReading & {
  source: "REAL" | "SIMULATED";
  receivedAtMs: number;
};

export type RochiSerialStatus =
  | "CLOSED"
  | "OPENING"
  | "OPEN"
  | "DISCONNECTED"
  | "ERROR";

export type RochiSerialSnapshot = {
  status: RochiSerialStatus;
  source: "REAL" | "SIMULATED";
  path: string;
  reading?: RochiMeasurement;
  ageMs?: number;
  stale: boolean;
  pendingFragmentLength: number;
  synchronized: boolean;
  error?: string;
};

const DEFAULT_BAUD_RATE = 9600;
const DEFAULT_DATA_BITS = 8;
const DEFAULT_STOP_BITS = 1;
const DEFAULT_PARITY: RochiSerialParity = "none";
const DEFAULT_MAX_READING_AGE_MS = 2_000;

export class RochiA01eSerialScale {
  private readonly parser: RochiA01eParser;
  private readonly config: Required<
    Pick<
      RochiSerialConfig,
      | "baudRate"
      | "dataBits"
      | "stopBits"
      | "parity"
      | "rtscts"
      | "maxReadingAgeMs"
    >
  > & RochiSerialConfig;
  private readonly source: "REAL" | "SIMULATED";
  private port?: RochiSerialPort;
  private status: RochiSerialStatus = "CLOSED";
  private latest?: RochiMeasurement;
  private lastError?: string;
  private initialBuffer = "";
  private synchronized = false;
  private connectionGeneration = 0;
  private readingHandler?: (reading: RochiMeasurement) => void;
  private parseErrorHandler?: (error: RochiA01eParserError) => void;

  constructor(
    config: RochiSerialConfig,
    private readonly portFactory: RochiSerialPortFactory,
    source: "REAL" | "SIMULATED" = "REAL"
  ) {
    this.config = {
      ...config,
      baudRate: config.baudRate ?? DEFAULT_BAUD_RATE,
      dataBits: config.dataBits ?? DEFAULT_DATA_BITS,
      stopBits: config.stopBits ?? DEFAULT_STOP_BITS,
      parity: config.parity ?? DEFAULT_PARITY,
      rtscts: config.rtscts ?? false,
      maxReadingAgeMs: config.maxReadingAgeMs ?? DEFAULT_MAX_READING_AGE_MS,
    };
    this.source = source;
    this.parser = new RochiA01eParser({
      sourceUnit: config.sourceUnit,
      maxBufferLength: config.maxBufferLength,
    });

    if (!this.config.path.trim()) {
      throw new Error("ROCHI serial path is required");
    }
    if (!Number.isInteger(this.config.baudRate) || this.config.baudRate <= 0) {
      throw new Error("ROCHI baudRate must be a positive integer");
    }
    if (!Number.isInteger(this.config.maxReadingAgeMs) || this.config.maxReadingAgeMs <= 0) {
      throw new Error("ROCHI maxReadingAgeMs must be a positive integer");
    }
  }

  onReading(handler: (reading: RochiMeasurement) => void): void {
    this.readingHandler = handler;
  }

  onParseError(handler: (error: RochiA01eParserError) => void): void {
    this.parseErrorHandler = handler;
  }

  open(): Promise<void> {
    if (this.status === "OPEN" || this.status === "OPENING") {
      return Promise.resolve();
    }

    if (this.port) {
      return this.close().then(() => this.open());
    }

    this.status = "OPENING";
    this.lastError = undefined;
    this.invalidateReadingState();
    const generation = ++this.connectionGeneration;
    const port = this.portFactory({
      path: this.config.path,
      baudRate: this.config.baudRate,
      dataBits: this.config.dataBits,
      stopBits: this.config.stopBits,
      parity: this.config.parity,
      rtscts: this.config.rtscts,
      autoOpen: false,
    });
    this.port = port;
    port.on("data", (data) => this.handleData(data, port, generation));
    port.on("error", (error) => this.handleError(error, port, generation));
    port.on("close", () => this.handleClose(port, generation));

    return new Promise((resolve, reject) => {
      port.open((error) => {
        if (!this.isCurrentConnection(port, generation)) {
          return;
        }
        if (error) {
          this.status = "ERROR";
          this.lastError = error.message;
          this.port = undefined;
          this.invalidateReadingState();
          reject(error);
          return;
        }
        this.status = "OPEN";
        resolve();
      });
    });
  }

  async reconnect(): Promise<void> {
    await this.close();
    this.parser.reset();
    await this.open();
  }

  close(): Promise<void> {
    const currentPort = this.port;
    this.port = undefined;
    this.connectionGeneration += 1;
    this.invalidateReadingState();
    this.status = "CLOSED";

    if (!currentPort || currentPort.isOpen === false) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      currentPort.close((error) => (error ? reject(error) : resolve()));
    });
  }

  snapshot(nowMs = Date.now()): RochiSerialSnapshot {
    const ageMs = this.latest ? Math.max(0, nowMs - this.latest.receivedAtMs) : undefined;
    const stale = ageMs === undefined || ageMs > this.config.maxReadingAgeMs;
    return {
      status: this.status,
      source: this.source,
      path: this.config.path,
      reading: stale ? undefined : this.latest,
      ageMs,
      stale,
      pendingFragmentLength: this.parser.getPendingFragmentLength(),
      synchronized: this.synchronized,
      error: this.lastError,
    };
  }

  private handleData(data: Buffer, port: RochiSerialPort, generation: number): void {
    if (!this.isCurrentConnection(port, generation) || this.status !== "OPEN") {
      return;
    }
    const chunk = data.toString("latin1");
    if (!this.synchronized) {
      this.handleInitialSynchronization(chunk);
      return;
    }

    this.handleParserOutput(this.parser.feed(chunk));
  }

  private handleInitialSynchronization(chunk: string): void {
    this.initialBuffer += chunk;
    const delimiterIndex = this.initialBuffer.indexOf("\r\n");
    const maxBufferLength = this.config.maxBufferLength ?? 128;

    if (delimiterIndex < 0) {
      if (this.initialBuffer.length > maxBufferLength) {
        this.initialBuffer = "";
        this.synchronized = true;
      }
      return;
    }

    const firstFrame = this.initialBuffer.slice(0, delimiterIndex);
    const remaining = this.initialBuffer.slice(delimiterIndex + 2);
    this.initialBuffer = "";
    this.synchronized = true;

    // Parse the first complete candidate. Invalid startup bytes are discarded
    // as synchronization noise; all later invalid frames remain observable.
    const firstResult = this.parser.feed(`${firstFrame}\r\n`);
    this.handleParserOutput(firstResult, firstResult.readings.length === 0);
    if (remaining) {
      this.handleParserOutput(this.parser.feed(remaining));
    }
  }

  private handleParserOutput(
    result: ReturnType<RochiA01eParser["feed"]>,
    suppressErrors = false
  ): void {
    if (!suppressErrors) {
      result.errors.forEach((error) => this.parseErrorHandler?.(error));
    }
    result.readings.forEach((reading) => {
      const measurement: RochiMeasurement = {
        ...reading,
        source: this.source,
        receivedAtMs: Date.now(),
      };
      this.latest = measurement;
      this.readingHandler?.(measurement);
    });
  }

  private handleError(error: Error, port: RochiSerialPort, generation: number): void {
    if (!this.isCurrentConnection(port, generation)) {
      return;
    }
    this.invalidateReadingState();
    this.status = "ERROR";
    this.lastError = error.message;
  }

  private handleClose(port: RochiSerialPort, generation: number): void {
    if (!this.isCurrentConnection(port, generation)) {
      return;
    }
    this.invalidateReadingState();
    this.port = undefined;
    this.connectionGeneration += 1;
    if (this.status !== "CLOSED" && this.status !== "ERROR") {
      this.status = "DISCONNECTED";
    }
  }

  private invalidateReadingState(): void {
    this.parser.reset();
    this.initialBuffer = "";
    this.synchronized = false;
    this.latest = undefined;
  }

  private isCurrentConnection(port: RochiSerialPort, generation: number): boolean {
    return this.port === port && this.connectionGeneration === generation;
  }
}
