"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemUsbPrinterDiscovery = void 0;
const usb_printer_discovery_1 = require("../shared/usb/usb-printer-discovery");
const agent_installation_state_store_1 = require("./agent-installation-state.store");
const device_discovery_provider_factory_1 = require("./device-discovery-provider.factory");
class SystemUsbPrinterDiscovery {
    provider;
    agentInstallationId;
    constructor(provider = (0, device_discovery_provider_factory_1.createPlatformDeviceDiscoveryProvider)(), agentInstallationId = (0, agent_installation_state_store_1.getAgentInstallationId)()) {
        this.provider = provider;
        this.agentInstallationId = agentInstallationId;
    }
    list() {
        return this.provider
            .listUsbPrinters()
            .map((printer) => (0, usb_printer_discovery_1.buildUsbPrinterDescriptor)(printer.name, printer, this.agentInstallationId));
    }
}
exports.SystemUsbPrinterDiscovery = SystemUsbPrinterDiscovery;
//# sourceMappingURL=system-usb-printer-discovery.js.map