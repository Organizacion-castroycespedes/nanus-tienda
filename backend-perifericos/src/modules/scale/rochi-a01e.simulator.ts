import type { RochiSerialPort, RochiSerialPortFactory, RochiSerialPortOptions } from "./rochi-a01e.serial";

type Listener<T> = (value: T) => void;

export class RochiA01eSimulatorPort implements RochiSerialPort {
  isOpen = false;
  openCount = 0;
  closeCount = 0;
  private readonly listeners = {
    data: [] as Listener<Buffer>[],
    error: [] as Listener<Error>[],
    close: [] as Listener<void>[],
  };

  on(event: "data" | "error" | "close", listener: Listener<Buffer> | Listener<Error> | Listener<void>): RochiSerialPort {
    this.listeners[event].push(listener as never);
    return this;
  }

  open(callback: (error?: Error | null) => void): void {
    this.openCount += 1;
    this.isOpen = true;
    callback();
  }

  close(callback: (error?: Error | null) => void): void {
    this.closeCount += 1;
    this.isOpen = false;
    this.emitClose();
    callback();
  }

  emitFrame(frame: string): void {
    this.emitData(Buffer.from(frame, "ascii"));
  }

  emitData(data: Buffer): void {
    this.listeners.data.forEach((listener) => listener(data));
  }

  emitError(error: Error): void {
    this.listeners.error.forEach((listener) => listener(error));
  }

  emitClose(): void {
    this.listeners.close.forEach((listener) => listener());
  }
}

export const createRochiA01eSimulatorFactory = (
  capture: { port?: RochiA01eSimulatorPort } = {}
): RochiSerialPortFactory => {
  return (_options: RochiSerialPortOptions) => {
    const port = capture.port ?? new RochiA01eSimulatorPort();
    capture.port = port;
    return port;
  };
};
