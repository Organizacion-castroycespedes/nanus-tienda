"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodePowerShellRawPrint = exports.WindowsRawSpoolerTransport = void 0;
const node_child_process_1 = require("node:child_process");
const systemCommandRunner = (command, args, input) => {
    (0, node_child_process_1.execFileSync)(command, args, {
        input,
        encoding: "utf8",
        windowsHide: true,
        timeout: 15000,
    });
};
class WindowsRawSpoolerTransport {
    commandRunner;
    transportName = "WindowsRawSpoolerTransport";
    constructor(commandRunner = systemCommandRunner) {
        this.commandRunner = commandRunner;
    }
    send(input) {
        this.commandRunner("powershell.exe", [
            "-NoProfile",
            "-NonInteractive",
            "-EncodedCommand",
            (0, exports.encodePowerShellRawPrint)(input.nativeIdentifier, input.payload, input.jobName),
        ]);
        return { bytesSent: input.payload.length };
    }
}
exports.WindowsRawSpoolerTransport = WindowsRawSpoolerTransport;
const encodePowerShellRawPrint = (queueName, payload, jobName) => {
    const queueBase64 = Buffer.from(queueName, "utf8").toString("base64");
    const payloadBase64 = payload.toString("base64");
    const jobBase64 = Buffer.from(jobName, "utf8").toString("base64");
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
        `$job = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${jobBase64}'))`,
        "$handle = [IntPtr]::Zero; $docStarted = $false; $pageStarted = $false",
        "try {",
        "if (-not [MANUS_RAW_PRINTER]::OpenPrinter($queue, [ref]$handle, [IntPtr]::Zero)) { throw ('OpenPrinter failed: ' + [Runtime.InteropServices.Marshal]::GetLastWin32Error()) }",
        "$doc = New-Object MANUS_DOC_INFO_1; $doc.pDocName = $job; $doc.pDatatype = 'RAW'",
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
exports.encodePowerShellRawPrint = encodePowerShellRawPrint;
//# sourceMappingURL=windows-raw-spooler.transport.js.map