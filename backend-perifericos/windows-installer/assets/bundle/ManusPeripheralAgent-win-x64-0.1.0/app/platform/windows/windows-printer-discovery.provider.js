"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWindowsPrinterNames = exports.WindowsPrinterDiscoveryProvider = void 0;
const node_child_process_1 = require("node:child_process");
const common_1 = require("@nestjs/common");
const systemCommandRunner = (command, args) => (0, node_child_process_1.execFileSync)(command, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 5000,
});
class WindowsPrinterDiscoveryProvider {
    commandRunner;
    constructor(commandRunner = systemCommandRunner) {
        this.commandRunner = commandRunner;
    }
    listUsbPrinters() {
        try {
            return (0, exports.parseWindowsPrinterNames)(this.commandRunner("powershell.exe", [
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Get-Printer | Where-Object { $_.Type -eq 'Local' -and $_.PortName -match '^(USB|DOT4USB)' } | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress",
            ])).map((queueName) => ({
                name: queueName,
                nativeIdentifier: queueName,
                fingerprint: { source: "WINDOWS_PRINT_QUEUE", values: { queueName } },
                platform: "WINDOWS",
                architecture: process.arch,
            }));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "unknown error";
            throw new common_1.BadRequestException(`USB printer discovery failed: ${message}`);
        }
    }
}
exports.WindowsPrinterDiscoveryProvider = WindowsPrinterDiscoveryProvider;
const parseWindowsPrinterNames = (output) => {
    const trimmed = output.trim();
    if (!trimmed || trimmed === "null") {
        return [];
    }
    try {
        const parsed = JSON.parse(trimmed);
        const values = Array.isArray(parsed) ? parsed : [parsed];
        return values.filter((value) => typeof value === "string" && Boolean(value.trim()));
    }
    catch {
        return trimmed.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    }
};
exports.parseWindowsPrinterNames = parseWindowsPrinterNames;
//# sourceMappingURL=windows-printer-discovery.provider.js.map