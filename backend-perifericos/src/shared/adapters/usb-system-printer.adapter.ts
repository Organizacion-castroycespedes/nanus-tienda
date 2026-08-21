import { execFileSync } from "node:child_process";
import { BadRequestException } from "@nestjs/common";
import {
  buildTestPrintDocument,
  buildTicketPrintDocument,
} from "../escpos-mock/thermal-ticket.formatter";
import { EscPosMockCommandName } from "../escpos-mock/escpos-mock.types";
import { renderThermalEscPos } from "../escpos/thermal-escpos.renderer";
import {
  getPeripheralsConfig,
  type UsbPrintTransport,
} from "../config/peripherals.config";
import { ConnectionType, DeviceType, type PeripheralDevice } from "../types/peripheral.types";
import type { DeviceProfile } from "../profiles/device-profiles";
import type {
  AdapterCapabilities,
  PrintTicketAdapterInput,
  PrinterAdapter,
  PrinterAdapterInput,
  PrinterAdapterResult,
} from "./peripheral-adapter.types";

export type UsbPrintCommandRunner = (
  command: string,
  args: string[],
  input?: string
) => void;

const systemPrintCommandRunner: UsbPrintCommandRunner = (command, args, input) => {
  execFileSync(command, args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    timeout: 15000,
  });
};

/** Queue name comes only from agent discovery. Browser never sends ESC/POS. */
export class UsbSystemPrinterAdapter implements PrinterAdapter {
  readonly type = DeviceType.PRINTER;
  readonly connectionType = ConnectionType.USB;
  readonly mode = "REAL" as const;

  constructor(
    private readonly platform = process.platform,
    private readonly commandRunner: UsbPrintCommandRunner = systemPrintCommandRunner,
    private readonly transport: UsbPrintTransport = getPeripheralsConfig().usbPrintTransport,
    private readonly physicalCutCertified =
      getPeripheralsConfig().usbRawPhysicalCutCertified
  ) {}

  get adapterName(): string {
    return this.transport === "RAW"
      ? "UsbRawPrinterAdapter"
      : "UsbSystemPrinterAdapter";
  }

  getCapabilities(profile: DeviceProfile): AdapterCapabilities {
    return {
      adapterName: this.adapterName,
      mode: this.mode,
      connectionType: this.connectionType,
      supportsCut: profile.supportsCut,
      supportsPhysicalCut:
        this.transport === "RAW" &&
        profile.supportsCut &&
        this.physicalCutCertified,
      supportsCashDrawerPulse: false,
    };
  }

  printTest(input: PrinterAdapterInput): PrinterAdapterResult {
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
    const bytesSent = this.print(input.device, document.preview, commands);

    return {
      adapterName: this.adapterName,
      profile: input.profile,
      capabilities: this.getCapabilities(input.profile),
      preview: document.preview,
      commands,
      bytesSent,
    };
  }

  printTicket(input: PrintTicketAdapterInput): PrinterAdapterResult {
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
    const bytesSent = this.print(input.device, document.preview, commands);

    return {
      adapterName: this.adapterName,
      profile: input.profile,
      capabilities: this.getCapabilities(input.profile),
      preview: document.preview,
      commands,
      bytesSent,
    };
  }

  private validateDevice(device: PeripheralDevice): void {
    if (device.type !== DeviceType.PRINTER) {
      throw new BadRequestException("device must be PRINTER");
    }
    if (device.connectionType !== ConnectionType.USB || !device.usb) {
      throw new BadRequestException("device connectionType must be USB with discovered usb config");
    }
  }

  private resolveRawCommands(
    commands: PrinterAdapterResult["commands"],
    profile: DeviceProfile
  ) {
    if (this.transport === "RAW" && profile.supportsCut) {
      return commands;
    }
    return commands.filter((command) => command.name !== EscPosMockCommandName.Cut);
  }

  private print(
    device: PeripheralDevice,
    preview: string,
    commands: PrinterAdapterResult["commands"]
  ): number | undefined {
    const queueName = device.usb?.printerName;
    if (!queueName) {
      throw new BadRequestException("USB printer queue is required");
    }

    try {
      if (this.transport === "RAW") {
        if (this.platform !== "win32") {
          throw new BadRequestException(
            "USB RAW printing is only supported on Windows; configure PERIPHERALS_USB_PRINT_TRANSPORT=GDI for the system-queue fallback"
          );
        }
        const payload = renderThermalEscPos(commands, preview, {
          encoding: "latin1",
          includePhysicalCut: commands.some(
            (command) => command.name === EscPosMockCommandName.Cut
          ),
        });
        this.commandRunner("powershell.exe", [
          "-NoProfile",
          "-NonInteractive",
          "-EncodedCommand",
          encodePowerShellRawPrint(queueName, payload),
        ]);
        return payload.length;
      }

      this.printGdi(queueName, preview);
      return undefined;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "unknown print error";
      const label = this.transport === "RAW" ? "USB RAW printer" : "USB GDI printer";
      throw new BadRequestException(`${label} print failed: ${message}`);
    }
  }

  private printGdi(queueName: string, document: string): void {
    if (this.platform === "win32") {
      this.commandRunner("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        encodePowerShellGdiPrint(queueName, document),
      ]);
      return;
    }

    if (this.platform === "linux" || this.platform === "darwin") {
      this.commandRunner("lp", ["-d", queueName, "-o", "raw"], document);
      return;
    }

    throw new BadRequestException(`USB printer transport is not supported on ${this.platform}`);
  }
}

const encodePowerShellGdiPrint = (queueName: string, document: string): string => {
  const queueBase64 = Buffer.from(queueName, "utf8").toString("base64");
  const documentBase64 = Buffer.from(document, "utf8").toString("base64");
  const script = [
    "Add-Type -AssemblyName System.Drawing",
    `$queue = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${queueBase64}'))`,
    `$documentText = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${documentBase64}'))`,
    "$printDocument = New-Object System.Drawing.Printing.PrintDocument",
    "$printDocument.PrinterSettings.PrinterName = $queue",
    "if (-not $printDocument.PrinterSettings.IsValid) { throw 'USB printer queue not found' }",
    "$printDocument.add_PrintPage({ param($sender, $event) $font = New-Object System.Drawing.Font('Consolas', 8); $event.Graphics.DrawString($documentText, $font, [System.Drawing.Brushes]::Black, 0, 0); $event.HasMorePages = $false })",
    "$printDocument.Print()",
  ].join("; ");

  return Buffer.from(script, "utf16le").toString("base64");
};

const encodePowerShellRawPrint = (queueName: string, payload: Buffer): string => {
  const queueBase64 = Buffer.from(queueName, "utf8").toString("base64");
  const payloadBase64 = payload.toString("base64");
  const script = [
    "Add-Type -TypeDefinition @'",
    "using System; using System.Runtime.InteropServices;",
    "[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public class MANUS_DOC_INFO_1 { public string pDocName; public string pOutputFile; public string pDatatype; }",
    "public static class MANUS_RAW_PRINTER {",
    "[DllImport(\"winspool.drv\", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);",
    "[DllImport(\"winspool.drv\", SetLastError=true)] public static extern bool ClosePrinter(IntPtr handle);",
    "[DllImport(\"winspool.drv\", CharSet=CharSet.Unicode, SetLastError=true)] public static extern int StartDocPrinter(IntPtr handle, int level, [In] MANUS_DOC_INFO_1 docInfo);",
    "[DllImport(\"winspool.drv\", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr handle);",
    "[DllImport(\"winspool.drv\", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr handle);",
    "[DllImport(\"winspool.drv\", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr handle);",
    "[DllImport(\"winspool.drv\", SetLastError=true)] public static extern bool WritePrinter(IntPtr handle, byte[] bytes, int count, out int written);",
    "}",
    "'@",
    `$queue = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${queueBase64}'))`,
    `$payload = [Convert]::FromBase64String('${payloadBase64}')`,
    "$handle = [IntPtr]::Zero; $docStarted = $false; $pageStarted = $false",
    "try {",
    "if (-not [MANUS_RAW_PRINTER]::OpenPrinter($queue, [ref]$handle, [IntPtr]::Zero)) { throw ('OpenPrinter failed: ' + [Runtime.InteropServices.Marshal]::GetLastWin32Error()) }",
    "$doc = New-Object MANUS_DOC_INFO_1; $doc.pDocName = 'Manus POS ESC/POS'; $doc.pDatatype = 'RAW'",
    "if ([MANUS_RAW_PRINTER]::StartDocPrinter($handle, 1, $doc) -le 0) { throw ('StartDocPrinter failed: ' + [Runtime.InteropServices.Marshal]::GetLastWin32Error()) }; $docStarted = $true",
    "if (-not [MANUS_RAW_PRINTER]::StartPagePrinter($handle)) { throw ('StartPagePrinter failed: ' + [Runtime.InteropServices.Marshal]::GetLastWin32Error()) }; $pageStarted = $true",
    "$written = 0; if (-not [MANUS_RAW_PRINTER]::WritePrinter($handle, $payload, $payload.Length, [ref]$written)) { throw ('WritePrinter failed: ' + [Runtime.InteropServices.Marshal]::GetLastWin32Error()) }",
    "if ($written -ne $payload.Length) { throw ('WritePrinter partial write: ' + $written + '/' + $payload.Length) }",
    "} finally {",
    "if ($pageStarted) { [void][MANUS_RAW_PRINTER]::EndPagePrinter($handle) }; if ($docStarted) { [void][MANUS_RAW_PRINTER]::EndDocPrinter($handle) }; if ($handle -ne [IntPtr]::Zero) { [void][MANUS_RAW_PRINTER]::ClosePrinter($handle) }",
    "}",
  ].join("\n");

  return Buffer.from(script, "utf16le").toString("base64");
};
