"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCupsUsbPrinterNames = exports.CupsPrinterDiscoveryProvider = void 0;
const node_child_process_1 = require("node:child_process");
const common_1 = require("@nestjs/common");
const systemCommandRunner = (command, args) => (0, node_child_process_1.execFileSync)(command, args, { encoding: "utf8", timeout: 5000 });
class CupsPrinterDiscoveryProvider {
    platform;
    commandRunner;
    constructor(platform, commandRunner = systemCommandRunner) {
        this.platform = platform;
        this.commandRunner = commandRunner;
    }
    listUsbPrinters() {
        try {
            return (0, exports.parseCupsUsbPrinterNames)(this.commandRunner("lpstat", ["-v"])).map((queueName) => ({
                name: queueName,
                nativeIdentifier: queueName,
                fingerprint: { source: "CUPS_QUEUE", values: { queueName } },
                platform: this.platform === "darwin" ? "MACOS" : "LINUX",
                architecture: process.arch,
            }));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "unknown error";
            throw new common_1.BadRequestException(`USB printer discovery failed: ${message}`);
        }
    }
}
exports.CupsPrinterDiscoveryProvider = CupsPrinterDiscoveryProvider;
const parseCupsUsbPrinterNames = (output) => output
    .split(/\r?\n/)
    .map((line) => line.match(/^device for (.+?):\s+usb:/i)?.[1]?.trim())
    .filter((value) => Boolean(value));
exports.parseCupsUsbPrinterNames = parseCupsUsbPrinterNames;
//# sourceMappingURL=cups-printer-discovery.provider.js.map