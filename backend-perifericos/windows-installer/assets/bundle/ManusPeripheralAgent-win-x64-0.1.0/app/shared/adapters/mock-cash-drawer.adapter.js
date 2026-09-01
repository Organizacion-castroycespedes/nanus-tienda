"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockCashDrawerAdapter = void 0;
const thermal_ticket_formatter_1 = require("../escpos-mock/thermal-ticket.formatter");
const peripheral_types_1 = require("../types/peripheral.types");
class MockCashDrawerAdapter {
    type = peripheral_types_1.DeviceType.CASH_DRAWER;
    connectionType = peripheral_types_1.ConnectionType.MOCK;
    mode = "MOCK";
    adapterName = "MockCashDrawerAdapter";
    getCapabilities(profile, _device) {
        return {
            adapterName: this.adapterName,
            mode: this.mode,
            connectionType: this.connectionType,
            supportsCut: profile.supportsCut,
            supportsPhysicalCut: false,
            supportsCashDrawerPulse: profile.supportsCashDrawerPulse,
        };
    }
    open(input) {
        return {
            adapterName: this.adapterName,
            profile: input.profile,
            capabilities: this.getCapabilities(input.profile, input.device),
            commands: (0, thermal_ticket_formatter_1.createCashDrawerPulseCommands)(),
            pulse: input.pulse,
        };
    }
}
exports.MockCashDrawerAdapter = MockCashDrawerAdapter;
//# sourceMappingURL=mock-cash-drawer.adapter.js.map