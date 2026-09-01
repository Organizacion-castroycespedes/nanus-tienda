"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeripheralAdapterResolver = exports.REAL_ADAPTERS_DISABLED_MESSAGE = void 0;
const common_1 = require("@nestjs/common");
const peripheral_types_1 = require("../types/peripheral.types");
const peripherals_config_1 = require("../config/peripherals.config");
const device_profiles_1 = require("../profiles/device-profiles");
const mock_cash_drawer_adapter_1 = require("./mock-cash-drawer.adapter");
const mock_printer_adapter_1 = require("./mock-printer.adapter");
const network_escpos_printer_adapter_1 = require("./network-escpos-printer.adapter");
const usb_system_printer_adapter_1 = require("./usb-system-printer.adapter");
exports.REAL_ADAPTERS_DISABLED_MESSAGE = "Real peripheral adapters are disabled. Enable PERIPHERALS_ENABLE_REAL_ADAPTERS=true to use them.";
class PeripheralAdapterResolver {
    realAdaptersEnabled;
    mockPrinterAdapter = new mock_printer_adapter_1.MockPrinterAdapter();
    mockCashDrawerAdapter = new mock_cash_drawer_adapter_1.MockCashDrawerAdapter();
    networkEscposPrinterAdapter = new network_escpos_printer_adapter_1.NetworkEscposPrinterAdapter();
    usbSystemPrinterAdapter = new usb_system_printer_adapter_1.UsbSystemPrinterAdapter();
    constructor(realAdaptersEnabled = (0, peripherals_config_1.getPeripheralsConfig)().realAdaptersEnabled) {
        this.realAdaptersEnabled = realAdaptersEnabled;
    }
    resolveProfile(device) {
        return (0, device_profiles_1.getDeviceProfile)(device.profileId);
    }
    resolvePrinter(device, mode) {
        if (device.type !== peripheral_types_1.DeviceType.PRINTER) {
            throw new common_1.BadRequestException("device must be PRINTER");
        }
        if (mode === "MOCK" && device.connectionType === peripheral_types_1.ConnectionType.MOCK) {
            return this.mockPrinterAdapter;
        }
        this.assertRealAdaptersEnabled(device.connectionType);
        if (device.connectionType === peripheral_types_1.ConnectionType.NETWORK) {
            return this.networkEscposPrinterAdapter;
        }
        if (device.connectionType === peripheral_types_1.ConnectionType.USB) {
            return this.usbSystemPrinterAdapter;
        }
        throw new common_1.BadRequestException(`Adapter for connection type ${device.connectionType} is not implemented yet.`);
    }
    resolveCashDrawer(device, mode) {
        if (device.type === peripheral_types_1.DeviceType.PRINTER) {
            return this.resolvePrinter(device, mode);
        }
        if (device.type !== peripheral_types_1.DeviceType.CASH_DRAWER) {
            throw new common_1.BadRequestException("device must be CASH_DRAWER");
        }
        if (mode === "MOCK" && device.connectionType === peripheral_types_1.ConnectionType.MOCK) {
            return this.mockCashDrawerAdapter;
        }
        this.assertRealAdaptersEnabled(device.connectionType);
        throw new common_1.BadRequestException(`Adapter for connection type ${device.connectionType} is not implemented yet.`);
    }
    assertRealAdaptersEnabled(connectionType) {
        if (!this.realAdaptersEnabled &&
            connectionType !== peripheral_types_1.ConnectionType.MOCK) {
            throw new common_1.BadRequestException(exports.REAL_ADAPTERS_DISABLED_MESSAGE);
        }
    }
}
exports.PeripheralAdapterResolver = PeripheralAdapterResolver;
//# sourceMappingURL=peripheral-adapter.resolver.js.map