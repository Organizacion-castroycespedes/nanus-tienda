"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlatformDeviceDiscoveryProvider = void 0;
const common_1 = require("@nestjs/common");
const cups_printer_discovery_provider_1 = require("./unix/cups-printer-discovery.provider");
const windows_printer_discovery_provider_1 = require("./windows/windows-printer-discovery.provider");
const createPlatformDeviceDiscoveryProvider = (platform = process.platform) => {
    if (platform === "win32") {
        return new windows_printer_discovery_provider_1.WindowsPrinterDiscoveryProvider();
    }
    if (platform === "linux" || platform === "darwin") {
        return new cups_printer_discovery_provider_1.CupsPrinterDiscoveryProvider(platform);
    }
    throw new common_1.BadRequestException(`USB printer discovery is not supported on ${platform}`);
};
exports.createPlatformDeviceDiscoveryProvider = createPlatformDeviceDiscoveryProvider;
//# sourceMappingURL=device-discovery-provider.factory.js.map