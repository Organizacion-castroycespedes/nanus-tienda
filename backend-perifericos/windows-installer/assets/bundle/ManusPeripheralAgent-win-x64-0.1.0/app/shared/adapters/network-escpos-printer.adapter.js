"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkEscposPrinterAdapter = void 0;
const common_1 = require("@nestjs/common");
const node_net_1 = require("node:net");
const escpos_mock_types_1 = require("../escpos-mock/escpos-mock.types");
const thermal_ticket_formatter_1 = require("../escpos-mock/thermal-ticket.formatter");
const thermal_escpos_renderer_1 = require("../escpos/thermal-escpos.renderer");
const peripheral_types_1 = require("../types/peripheral.types");
const network_device_validation_util_1 = require("../utils/network-device-validation.util");
class NetworkEscposPrinterAdapter {
    socketFactory;
    encoding;
    type = peripheral_types_1.DeviceType.PRINTER;
    connectionType = peripheral_types_1.ConnectionType.NETWORK;
    mode = "REAL";
    adapterName = "NetworkEscposPrinterAdapter";
    constructor(socketFactory = () => new node_net_1.Socket(), encoding = "utf8") {
        this.socketFactory = socketFactory;
        this.encoding = encoding;
    }
    getCapabilities(profile, _device) {
        return {
            adapterName: this.adapterName,
            mode: this.mode,
            connectionType: this.connectionType,
            supportsCut: profile.supportsCut,
            supportsPhysicalCut: profile.supportsCut,
            supportsCashDrawerPulse: profile.supportsCashDrawerPulse,
        };
    }
    async openCashDrawer(input) {
        this.validateDevice(input.device);
        const capabilities = this.getCapabilities(input.profile, input.device);
        if (!capabilities.supportsCashDrawerPulse) {
            throw new common_1.BadRequestException("printer does not support cash drawer pulse");
        }
        const commands = (0, thermal_ticket_formatter_1.createCashDrawerPulseCommands)();
        const payload = (0, thermal_escpos_renderer_1.buildCashDrawerPulseBytes)(input.pulse);
        const bytesSent = await this.send(input.device, payload);
        return {
            adapterName: this.adapterName,
            profile: input.profile,
            capabilities,
            commands,
            bytesSent,
            pulse: input.pulse,
        };
    }
    async printTest(input) {
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
        const payload = this.buildEscPosBuffer(commands, document.preview);
        const bytesSent = await this.send(input.device, payload);
        return {
            adapterName: this.adapterName,
            profile: input.profile,
            capabilities: this.getCapabilities(input.profile, input.device),
            preview: document.preview,
            commands,
            bytesSent,
        };
    }
    async printTicket(input) {
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
        const payload = this.buildEscPosBuffer(commands, document.preview);
        const bytesSent = await this.send(input.device, payload);
        return {
            adapterName: this.adapterName,
            profile: input.profile,
            capabilities: this.getCapabilities(input.profile, input.device),
            preview: document.preview,
            commands,
            bytesSent,
        };
    }
    buildEscPosBuffer(commands, preview, encoding = this.encoding) {
        return (0, thermal_escpos_renderer_1.renderThermalEscPos)(commands, preview, {
            encoding,
            includePhysicalCut: true,
        });
    }
    resolveRawCommands(commands, profile) {
        return profile.supportsCut
            ? commands
            : commands.filter((command) => command.name !== escpos_mock_types_1.EscPosMockCommandName.Cut);
    }
    validateDevice(device) {
        if (device.type !== peripheral_types_1.DeviceType.PRINTER) {
            throw new common_1.BadRequestException("device must be PRINTER");
        }
        if (device.connectionType !== peripheral_types_1.ConnectionType.NETWORK) {
            throw new common_1.BadRequestException("device connectionType must be NETWORK");
        }
        (0, network_device_validation_util_1.validateNetworkOptions)(device.network);
    }
    send(device, payload) {
        const network = (0, network_device_validation_util_1.validateNetworkOptions)(device.network);
        return new Promise((resolve, reject) => {
            const socket = this.socketFactory();
            let settled = false;
            const fail = (message, error) => {
                if (settled) {
                    return;
                }
                settled = true;
                socket.destroy(error);
                reject(new common_1.BadRequestException(message));
            };
            const complete = () => {
                if (settled) {
                    return;
                }
                settled = true;
                socket.end();
                resolve(payload.length);
            };
            socket.setTimeout(network.timeoutMs ?? 3000);
            socket.once("error", (error) => {
                fail("Network ESC/POS printer socket error: " + error.message, error);
            });
            socket.once("timeout", () => {
                fail("Network ESC/POS printer connection timed out");
            });
            socket.connect({ host: network.host, port: network.port }, () => {
                socket.write(payload, (error) => {
                    if (error) {
                        fail("Network ESC/POS printer write error: " + error.message, error);
                        return;
                    }
                    complete();
                });
            });
        });
    }
}
exports.NetworkEscposPrinterAdapter = NetworkEscposPrinterAdapter;
//# sourceMappingURL=network-escpos-printer.adapter.js.map