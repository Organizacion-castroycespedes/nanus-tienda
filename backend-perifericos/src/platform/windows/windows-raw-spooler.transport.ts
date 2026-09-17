import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  PrinterTransport,
  PrinterTransportInput,
  PrinterTransportResult,
} from "../../shared/transports/printer-transport";

export type WindowsPrintCommandRunner = (
  command: string,
  args: string[],
  input?: string
) => void;

export const MAX_WINDOWS_RAW_PRINT_JOB_BYTES = 8 * 1024 * 1024;

const systemCommandRunner: WindowsPrintCommandRunner = (command, args, input) => {
  execFileSync(command, args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    timeout: 15000,
  });
};

const rawSpoolerScript = String.raw`param(
  [Parameter(Mandatory=$true)][string]$QueueName,
  [Parameter(Mandatory=$true)][string]$PayloadPath,
  [Parameter(Mandatory=$true)][string]$JobName
)
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public class MANUS_DOC_INFO_1 { public string pDocName; public string pOutputFile; public string pDatatype; }
public static class MANUS_RAW_PRINTER {
[DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
[DllImport("winspool.drv", SetLastError=true)] public static extern bool ClosePrinter(IntPtr handle);
[DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)] public static extern int StartDocPrinter(IntPtr handle, int level, [In] MANUS_DOC_INFO_1 docInfo);
[DllImport("winspool.drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr handle);
[DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr handle);
[DllImport("winspool.drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr handle);
[DllImport("winspool.drv", SetLastError=true)] public static extern bool WritePrinter(IntPtr handle, byte[] bytes, int count, out int written);
}
'@
$payload = [IO.File]::ReadAllBytes($PayloadPath)
$handle = [IntPtr]::Zero; $docStarted = $false; $pageStarted = $false
try {
  if (-not [MANUS_RAW_PRINTER]::OpenPrinter($QueueName, [ref]$handle, [IntPtr]::Zero)) { throw ('OpenPrinter failed: ' + [Runtime.InteropServices.Marshal]::GetLastWin32Error()) }
  $doc = New-Object MANUS_DOC_INFO_1; $doc.pDocName = $JobName; $doc.pDatatype = 'RAW'
  if ([MANUS_RAW_PRINTER]::StartDocPrinter($handle, 1, $doc) -le 0) { throw ('StartDocPrinter failed: ' + [Runtime.InteropServices.Marshal]::GetLastWin32Error()) }; $docStarted = $true
  if (-not [MANUS_RAW_PRINTER]::StartPagePrinter($handle)) { throw ('StartPagePrinter failed: ' + [Runtime.InteropServices.Marshal]::GetLastWin32Error()) }; $pageStarted = $true
  $written = 0; if (-not [MANUS_RAW_PRINTER]::WritePrinter($handle, $payload, $payload.Length, [ref]$written)) { throw ('WritePrinter failed: ' + [Runtime.InteropServices.Marshal]::GetLastWin32Error()) }
  if ($written -ne $payload.Length) { throw ('WritePrinter partial write: ' + $written + '/' + $payload.Length) }
} finally {
  if ($pageStarted) { [void][MANUS_RAW_PRINTER]::EndPagePrinter($handle) }; if ($docStarted) { [void][MANUS_RAW_PRINTER]::EndDocPrinter($handle) }; if ($handle -ne [IntPtr]::Zero) { [void][MANUS_RAW_PRINTER]::ClosePrinter($handle) }
}`;

const systemTempDirectory = (): string => mkdtempSync(join(tmpdir(), "manus-raw-"));

export class WindowsRawSpoolerTransport implements PrinterTransport {
  readonly transportName = "WindowsRawSpoolerTransport";

  constructor(private readonly commandRunner: WindowsPrintCommandRunner = systemCommandRunner) {}

  send(input: PrinterTransportInput): PrinterTransportResult {
    if (input.payload.length > MAX_WINDOWS_RAW_PRINT_JOB_BYTES) {
      throw new Error(`RAW print job exceeds ${MAX_WINDOWS_RAW_PRINT_JOB_BYTES} bytes`);
    }

    const directory = systemTempDirectory();
    const payloadPath = join(directory, "payload.bin");
    const scriptPath = join(directory, "spool-raw.ps1");
    try {
      writeFileSync(payloadPath, input.payload, { mode: 0o600 });
      writeFileSync(scriptPath, rawSpoolerScript, { encoding: "utf8", mode: 0o600 });
      this.commandRunner("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        input.nativeIdentifier,
        payloadPath,
        input.jobName,
      ]);
      return { bytesSent: input.payload.length };
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
}

export const encodePowerShellRawPrint = (): string => rawSpoolerScript;
