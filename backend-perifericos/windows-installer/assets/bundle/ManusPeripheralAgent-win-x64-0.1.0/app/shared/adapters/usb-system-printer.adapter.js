"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsbSystemPrinterAdapter = void 0;
const node_child_process_1 = require("node:child_process");
const common_1 = require("@nestjs/common");
const thermal_ticket_formatter_1 = require("../escpos-mock/thermal-ticket.formatter");
const escpos_mock_types_1 = require("../escpos-mock/escpos-mock.types");
const thermal_escpos_renderer_1 = require("../escpos/thermal-escpos.renderer");
const peripherals_config_1 = require("../config/peripherals.config");
const peripheral_types_1 = require("../types/peripheral.types");
const windows_raw_spooler_transport_1 = require("../../platform/windows/windows-raw-spooler.transport");
const windows_gdi_spooler_transport_1 = require("../../platform/windows/windows-gdi-spooler.transport");
const systemPrintCommandRunner = (command, args, input) => {
    (0, node_child_process_1.execFileSync)(command, args, {
        input,
        encoding: "utf8",
        windowsHide: true,
        timeout: 15000,
    });
};
class UsbSystemPrinterAdapter {
    platform;
    commandRunner;
    transport;
    rawTransport;
    gdiTransport;
    type = peripheral_types_1.DeviceType.PRINTER;
    connectionType = peripheral_types_1.ConnectionType.USB;
    mode = "REAL";
    constructor(platform = process.platform, commandRunner = systemPrintCommandRunner, transport = (0, peripherals_config_1.getPeripheralsConfig)().usbPrintTransport, rawTransport = new windows_raw_spooler_transport_1.WindowsRawSpoolerTransport(commandRunner), gdiTransport = new windows_gdi_spooler_transport_1.WindowsGdiSpoolerTransport(commandRunner)) {
        this.platform = platform;
        this.commandRunner = commandRunner;
        this.transport = transport;
        this.rawTransport = rawTransport;
        this.gdiTransport = gdiTransport;
    }
    get adapterName() {
        return this.transport === "RAW"
            ? "UsbRawPrinterAdapter"
            : "UsbSystemPrinterAdapter";
    }
    getCapabilities(profile, device) {
        const drawerCertified = this.isCashDrawerPulseCertified(device);
        return {
            adapterName: this.adapterName,
            mode: this.mode,
            connectionType: this.connectionType,
            supportsCut: profile.supportsCut,
            supportsPhysicalCut: false,
            supportsCashDrawerPulse: profile.supportsCashDrawerPulse && drawerCertified,
        };
    }
    openCashDrawer(input) {
        this.validateDevice(input.device);
        const capabilities = this.getCapabilities(input.profile, input.device);
        if (!capabilities.supportsCashDrawerPulse) {
            throw new common_1.BadRequestException("printer drawer pulse is not certified for this device");
        }
        const queueName = input.device.usb?.printerName;
        if (!queueName) {
            throw new common_1.BadRequestException("USB printer queue is required");
        }
        const commands = (0, thermal_ticket_formatter_1.createCashDrawerPulseCommands)();
        const payload = (0, thermal_escpos_renderer_1.buildCashDrawerPulseBytes)(input.pulse);
        const bytesSent = this.rawTransport.send({
            nativeIdentifier: queueName,
            payload,
            jobName: "Manus POS cash drawer pulse",
        }).bytesSent;
        return {
            adapterName: this.adapterName,
            profile: input.profile,
            capabilities,
            commands,
            bytesSent,
            pulse: input.pulse,
        };
    }
    printTest(input) {
        this.validateDevice(input.device);
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
        const commands = this.resolveRawCommands(document.commands, input.profile);
        const bytesSent = this.print(input.device, document.preview, commands);
        return {
            adapterName: this.adapterName,
            profile: input.profile,
            capabilities: this.getCapabilities(input.profile, input.device),
            preview: document.preview,
            commands,
            bytesSent,
        };
    }
    printTicket(input) {
        this.validateDevice(input.device);
        const document = (0, thermal_ticket_formatter_1.buildTicketPrintDocument)({
            ticketType: input.ticketType,
            terminalId: input.terminalId,
            deviceId: input.device.id,
            content: input.content,
            widthChars: input.profile.widthChars,
            timestamp: input.timestamp,
        });
        const commands = this.resolveRawCommands(document.commands, input.profile);
        const bytesSent = this.print(input.device, document.preview, commands);
        return {
            adapterName: this.adapterName,
            profile: input.profile,
            capabilities: this.getCapabilities(input.profile, input.device),
            preview: document.preview,
            commands,
            bytesSent,
        };
    }
    validateDevice(device) {
        if (device.type !== peripheral_types_1.DeviceType.PRINTER) {
            throw new common_1.BadRequestException("device must be PRINTER");
        }
        if (device.connectionType !== peripheral_types_1.ConnectionType.USB || !device.usb) {
            throw new common_1.BadRequestException("device connectionType must be USB with discovered usb config");
        }
    }
    isCashDrawerPulseCertified(device) {
        return device?.metadata?.usbRawCashDrawerPulseCertified === true;
    }
    resolveRawCommands(commands, profile) {
        if (this.transport === "RAW" && profile.supportsCut) {
            return commands;
        }
        return commands.filter((command) => command.name !== escpos_mock_types_1.EscPosMockCommandName.Cut);
    }
    print(device, preview, commands) {
        const queueName = device.usb?.printerName;
        if (!queueName) {
            throw new common_1.BadRequestException("USB printer queue is required");
        }
        try {
            if (this.transport === "RAW") {
                if (this.platform !== "win32") {
                    throw new common_1.BadRequestException("USB RAW printing is only supported on Windows; configure PERIPHERALS_USB_PRINT_TRANSPORT=GDI for the system-queue fallback");
                }
                const payload = (0, thermal_escpos_renderer_1.renderThermalEscPos)(commands, preview, {
                    encoding: "latin1",
                    includePhysicalCut: commands.some((command) => command.name === escpos_mock_types_1.EscPosMockCommandName.Cut),
                });
                return this.rawTransport.send({
                    nativeIdentifier: queueName,
                    payload,
                    jobName: "Manus POS ESC/POS",
                }).bytesSent;
            }
            this.printGdi(queueName, preview);
            return undefined;
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            const message = error instanceof Error ? error.message : "unknown print error";
            const label = this.transport === "RAW" ? "USB RAW printer" : "USB GDI printer";
            throw new common_1.BadRequestException(`${label} print failed: ${message}`);
        }
    }
    printGdi(queueName, document) {
        if (this.platform === "win32") {
            this.gdiTransport.print(queueName, document);
            return;
        }
        if (this.platform === "linux" || this.platform === "darwin") {
            this.commandRunner("lp", ["-d", queueName, "-o", "raw"], document);
            return;
        }
        throw new common_1.BadRequestException(`USB printer transport is not supported on ${this.platform}`);
    }
}
exports.UsbSystemPrinterAdapter = UsbSystemPrinterAdapter;
//# sourceMappingURL=usb-system-printer.adapter.js.map