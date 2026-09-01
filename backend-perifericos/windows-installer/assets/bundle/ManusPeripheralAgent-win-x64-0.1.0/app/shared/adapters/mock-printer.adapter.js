"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockPrinterAdapter = void 0;
const common_1 = require("@nestjs/common");
const thermal_ticket_formatter_1 = require("../escpos-mock/thermal-ticket.formatter");
const peripheral_types_1 = require("../types/peripheral.types");
class MockPrinterAdapter {
    type = peripheral_types_1.DeviceType.PRINTER;
    connectionType = peripheral_types_1.ConnectionType.MOCK;
    mode = "MOCK";
    adapterName = "MockPrinterAdapter";
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
    openCashDrawer(input) {
        this.validateDrawerDevice(input.device);
        const commands = (0, thermal_ticket_formatter_1.createCashDrawerPulseCommands)();
        return {
            adapterName: this.adapterName,
            profile: input.profile,
            capabilities: this.getCapabilities(input.profile, input.device),
            commands,
            pulse: input.pulse,
        };
    }
    printTest(input) {
        const document = (0, thermal_ticket_formatter_1.buildTestPrintDocument)({
            agentName: input.agentName,
            mode: input.mode,
            terminalId: input.terminalId,
            deviceId: input.device.id,
            printerName: input.device.name,
            profileId: input.profile.id,
            connectionType: input.device.connectionType,
            widthChars: input.profile.widthChars,
            paperWidthMm: input.profile.paperWidthMm,
            timestamp: input.timestamp,
        });
        return {
            adapterName: this.adapterName,
            profile: input.profile,
            capabilities: this.getCapabilities(input.profile, input.device),
            preview: document.preview,
            commands: document.commands,
        };
    }
    printTicket(input) {
        const document = (0, thermal_ticket_formatter_1.buildTicketPrintDocument)({
            ticketType: input.ticketType,
            terminalId: input.terminalId,
            deviceId: input.device.id,
            content: input.content,
            widthChars: input.profile.widthChars,
            timestamp: input.timestamp,
        });
        return {
            adapterName: this.adapterName,
            profile: input.profile,
            capabilities: this.getCapabilities(input.profile, input.device),
            preview: document.preview,
            commands: document.commands,
        };
    }
    validateDrawerDevice(device) {
        if (device.type !== peripheral_types_1.DeviceType.PRINTER) {
            throw new common_1.BadRequestException("device must be PRINTER");
        }
    }
}
exports.MockPrinterAdapter = MockPrinterAdapter;
//# sourceMappingURL=mock-printer.adapter.js.map