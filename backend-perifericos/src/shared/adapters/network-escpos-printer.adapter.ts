import { BadRequestException } from "@nestjs/common";
import { Socket } from "node:net";
import type {
  EscPosMockCommand,
} from "../escpos-mock/escpos-mock.types";
import { EscPosMockCommandName } from "../escpos-mock/escpos-mock.types";
import {
  buildTestPrintDocument,
  buildTicketPrintDocument,
} from "../escpos-mock/thermal-ticket.formatter";
import {
  renderThermalEscPos,
  type EscPosTextEncoding,
} from "../escpos/thermal-escpos.renderer";
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

export type EscPosEncoding = EscPosTextEncoding;

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
      supportsPhysicalCut: profile.supportsCut,
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
      printerName: input.device.name,
      profileId: input.profile.id,
      connectionType: input.device.connectionType,
      widthChars: input.profile.widthChars,
      paperWidthMm: input.profile.paperWidthMm,
      timestamp: input.timestamp,
    });
    const commands = this.resolveRawCommands(document.commands, input.profile);
    const payload = this.buildEscPosBuffer(commands, document.preview);
    const bytesSent = await this.send(input.device, payload);

    return {
      adapterName: this.adapterName,
      profile: input.profile,
      capabilities: this.getCapabilities(input.profile),
      preview: document.preview,
      commands,
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
    const commands = this.resolveRawCommands(document.commands, input.profile);
    const payload = this.buildEscPosBuffer(commands, document.preview);
    const bytesSent = await this.send(input.device, payload);

    return {
      adapterName: this.adapterName,
      profile: input.profile,
      capabilities: this.getCapabilities(input.profile),
      preview: document.preview,
      commands,
      bytesSent,
    };
  }

  buildEscPosBuffer(
    commands: EscPosMockCommand[],
    preview: string,
    encoding: EscPosEncoding = this.encoding
  ): Buffer {
    return renderThermalEscPos(commands, preview, {
      encoding,
      includePhysicalCut: true,
    });
  }

  private resolveRawCommands(
    commands: EscPosMockCommand[],
    profile: DeviceProfile
  ): EscPosMockCommand[] {
    return profile.supportsCut
      ? commands
      : commands.filter((command) => command.name !== EscPosMockCommandName.Cut);
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
