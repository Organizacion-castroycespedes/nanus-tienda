"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildUsbPrinterDescriptor = void 0;
const node_crypto_1 = require("node:crypto");
const buildUsbPrinterDescriptor = (printerName, portable, agentInstallationId = "legacy-agent-installation") => {
    const normalizedName = printerName.trim();
    const hash = (0, node_crypto_1.createHash)("sha256").update(normalizedName).digest("hex").slice(0, 16);
    const deviceId = `usb-printer-${hash}`;
    return {
        id: deviceId,
        name: normalizedName,
        deviceId,
        printerName: normalizedName,
        descriptor: {
            agentInstallationId,
            deviceId,
            nativeIdentifier: portable?.nativeIdentifier ?? normalizedName,
            fingerprint: portable?.fingerprint ?? {
                source: "LEGACY_QUEUE_NAME",
                values: { queueName: normalizedName },
            },
            platform: portable?.platform ?? "UNKNOWN",
            architecture: portable?.architecture ?? "unknown",
        },
    };
};
exports.buildUsbPrinterDescriptor = buildUsbPrinterDescriptor;
//# sourceMappingURL=usb-printer-discovery.js.map