import { BadRequestException } from "@nestjs/common";
import { Socket } from "node:net";
import type {
  EscPosMockCommand,
  EscPosMockCommandName,
} from "../escpos-mock/escpos-mock.types";
import { EscPosMockCommandName as CommandName } from "../escpos-mock/escpos-mock.types";
import {
  buildTestPrintDocument,
  buildTicketPrintDocument,
} from "../escpos-mock/thermal-ticket.formatter";
import { ConnectionType, DeviceType, type PeripheralDevice } from "../types/peripheral.types";
import { validateNetworkOptions } from "../utils/network-device-validation.util";
import type { DeviceProfile } from "../profiles/device-profiles";
import type {
  AdapterCapabilities,
  PrintTicketAdapterInput,
  PrinterAdapter,
  PrinterAdapterInput,
  PrinterAdapterResult,
} from "./peripheral-adapter.types";

export type NetworkEscposSocket = {
  setTimeout(timeoutMs: number): void;
  connect(options: { host: string; port: number }, listener?: () => void): void;
  write(buffer: Buffer, callback?: (error?: Error) => void): boolean;
  end(): void;
  destroy(error?: Error): void;
  once(event: "error", listener: (error: Error) => void): NetworkEscposSocket;
  once(event: "timeout", listener: () => void): NetworkEscposSocket;
};

export type NetworkEscposSocketFactory = () => NetworkEscposSocket;

export type EscPosEncoding = "utf8" | "latin1";

const commandBytes: Record<EscPosMockCommandName, Buffer> = {
  INIT: Buffer.from([0x1b, 0x40]),
  ALIGN_LEFT: Buffer.from([0x1b, 0x61, 0x00]),
  ALIGN_CENTER: Buffer.from([0x1b, 0x61, 0x01]),
  ALIGN_RIGHT: Buffer.from([0x1b, 0x61, 0x02]),
  BOLD_ON: Buffer.from([0x1b, 0x45, 0x01]),
  BOLD_OFF: Buffer.from([0x1b, 0x45, 0x00]),
  DOUBLE_HEIGHT_ON: Buffer.from([0x1d, 0x21, 0x01]),
  DOUBLE_HEIGHT_OFF: Buffer.from([0x1d, 0x21, 0x00]),
  FEED: Buffer.from([0x0a, 0x0a]),
  CUT: Buffer.from([0x1d, 0x56, 0x00]),
  CASH_DRAWER_PULSE: Buffer.from([0x1b, 0x70, 0x00, 0x32, 0xfa]),
};

export class NetworkEscposPrinterAdapter implements PrinterAdapter {
  readonly type = DeviceType.PRINTER;
  readonly connectionType = ConnectionType.NETWORK;
  readonly mode = "REAL" as const;
  readonly adapterName = "NetworkEscposPrinterAdapter";

  constructor(
    private readonly socketFactory: NetworkEscposSocketFactory = () =>
      new Socket() as NetworkEscposSocket,
    private readonly encoding: EscPosEncoding = "utf8"
  ) {}

  getCapabilities(profile: DeviceProfile): AdapterCapabilities {
    return {
      adapterName: this.adapterName,
      mode: this.mode,
      connectionType: this.connectionType,
      supportsCut: profile.supportsCut,
      supportsCashDrawerPulse: false,
    };
  }

  async printTest(input: PrinterAdapterInput): Promise<PrinterAdapterResult> {
    this.validateDevice(input.device);
    const document = buildTestPrintDocument({
      agentName: input.agentName,
      mode: input.mode,
      terminalId: input.terminalId,
      deviceId: input.device.id,
      widthChars: input.profile.widthChars,
      paperWidthMm: input.profile.paperWidthMm,
      timestamp: input.timestamp,
    });
    const payload = this.buildEscPosBuffer(document.commands, document.preview);
    const bytesSent = await this.send(input.device, payload);

    return {
      adapterName: this.adapterName,
      profile: input.profile,
      capabilities: this.getCapabilities(input.profile),
      preview: document.preview,
      commands: document.commands,
      bytesSent,
    };
  }

  async printTicket(input: PrintTicketAdapterInput): Promise<PrinterAdapterResult> {
    this.validateDevice(input.device);
    const document = buildTicketPrintDocument({
      ticketType: input.ticketType,
      terminalId: input.terminalId,
      deviceId: input.device.id,
      content: input.content,
      widthChars: input.profile.widthChars,
      timestamp: input.timestamp,
    });
    const payload = this.buildEscPosBuffer(document.commands, document.preview);
    const bytesSent = await this.send(input.device, payload);

    return {
      adapterName: this.adapterName,
      profile: input.profile,
      capabilities: this.getCapabilities(input.profile),
      preview: document.preview,
      commands: document.commands,
      bytesSent,
    };
  }

  buildEscPosBuffer(
    commands: EscPosMockCommand[],
    preview: string,
    encoding: EscPosEncoding = this.encoding
  ): Buffer {
    const prefix: Buffer[] = [];
    const suffix: Buffer[] = [];

    for (const command of commands) {
      const target =
        command.name === CommandName.Feed || command.name === CommandName.Cut
          ? suffix
          : prefix;
      target.push(commandBytes[command.name]);
    }

    return Buffer.concat([
      ...prefix,
      Buffer.from(preview + "\n", encoding),
      ...suffix,
    ]);
  }

  private validateDevice(device: PeripheralDevice): void {
    if (device.type !== DeviceType.PRINTER) {
      throw new BadRequestException("device must be PRINTER");
    }
    if (device.connectionType !== ConnectionType.NETWORK) {
      throw new BadRequestException("device connectionType must be NETWORK");
    }
    validateNetworkOptions(device.network);
  }

  private send(device: PeripheralDevice, payload: Buffer): Promise<number> {
    const network = validateNetworkOptions(device.network);

    return new Promise((resolve, reject) => {
      const socket = this.socketFactory();
      let settled = false;

      const fail = (message: string, error?: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        socket.destroy(error);
        reject(new BadRequestException(message));
      };

      const complete = () => {
        if (settled) {
          return;
        }
        settled = true;
        socket.end();
        resolve(payload.length);
      };

      socket.setTimeout(network.timeoutMs ?? 3000);
      socket.once("error", (error) => {
        fail("Network ESC/POS printer socket error: " + error.message, error);
      });
      socket.once("timeout", () => {
        fail("Network ESC/POS printer connection timed out");
      });
      socket.connect({ host: network.host, port: network.port }, () => {
        socket.write(payload, (error?: Error) => {
          if (error) {
            fail("Network ESC/POS printer write error: " + error.message, error);
            return;
          }
          complete();
        });
      });
    });
  }
}
