"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindowsGdiSpoolerTransport = void 0;
class WindowsGdiSpoolerTransport {
    commandRunner;
    constructor(commandRunner) {
        this.commandRunner = commandRunner;
    }
    print(queueName, document) {
        this.commandRunner("powershell.exe", [
            "-NoProfile",
            "-NonInteractive",
            "-EncodedCommand",
            encodePowerShellGdiPrint(queueName, document),
        ]);
    }
}
exports.WindowsGdiSpoolerTransport = WindowsGdiSpoolerTransport;
const encodePowerShellGdiPrint = (queueName, document) => {
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
//# sourceMappingURL=windows-gdi-spooler.transport.js.map