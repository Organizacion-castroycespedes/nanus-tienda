"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CashDrawerService = void 0;
const common_1 = require("@nestjs/common");
const peripheral_types_1 = require("../../shared/types/peripheral.types");
const peripherals_config_1 = require("../../shared/config/peripherals.config");
const peripheral_adapter_resolver_1 = require("../../shared/adapters/peripheral-adapter.resolver");
const id_util_1 = require("../../shared/utils/id.util");
const request_validation_util_1 = require("../../shared/utils/request-validation.util");
const thermal_escpos_renderer_1 = require("../../shared/escpos/thermal-escpos.renderer");
const devices_service_1 = require("../devices/devices.service");
const events_service_1 = require("../events/events.service");
const logs_service_1 = require("../logs/logs.service");
const DEFAULT_TERMINAL_ID = "local-terminal";
const DEFAULT_REASON = "MANUAL";
let CashDrawerService = class CashDrawerService {
    devicesService;
    logsService;
    eventsService;
    adapterResolver = new peripheral_adapter_resolver_1.PeripheralAdapterResolver();
    constructor(devicesService, logsService, eventsService) {
        this.devicesService = devicesService;
        this.logsService = logsService;
        this.eventsService = eventsService;
    }
    async open(request) {
        const record = this.safeRecord(request, "cash drawer payload");
        const terminalId = (0, request_validation_util_1.validateIdentifier)((0, request_validation_util_1.optionalString)(record, "terminalId", DEFAULT_TERMINAL_ID), "terminalId");
        const reason = (0, request_validation_util_1.validateFormat)((0, request_validation_util_1.optionalString)(record, "reason", DEFAULT_REASON), "reason");
        const printerDeviceId = this.resolvePrinterDeviceId(record, terminalId);
        const printer = this.devicesService.findRequired(printerDeviceId, peripheral_types_1.DeviceType.PRINTER);
        const config = (0, peripherals_config_1.getPeripheralsConfig)();
        const profile = this.adapterResolver.resolveProfile(printer);
        const pulse = this.buildPulseProfile(profile.id);
        if (!profile.supportsCashDrawerPulse) {
            throw new common_1.BadRequestException("printer does not support cash drawer pulse");
        }
        if (printer.connectionType === peripheral_types_1.ConnectionType.USB &&
            !this.isUsbDrawerPulseCertified(printer)) {
            throw new common_1.BadRequestException("printer drawer pulse is not certified for this device");
        }
        const adapter = this.adapterResolver.resolvePrinter(printer, config.mode);
        const commandId = (0, id_util_1.createId)(adapter.mode === "REAL" ? "real-cashdrawer-open" : "mock-cashdrawer-open");
        const timestamp = new Date().toISOString();
        try {
            this.devicesService.assertUsbPrinterAvailable(printer);
            const result = await Promise.resolve(adapter.openCashDrawer({
                mode: adapter.mode,
                terminalId,
                device: printer,
                profile,
                commandId,
                reason,
                timestamp,
                pulse,
            }));
            const response = {
                success: true,
                commandId,
                mode: result.capabilities.mode,
                adapterName: result.adapterName,
                printerDeviceId: printer.id,
                deviceId: printer.id,
                terminalId,
                connectionType: printer.connectionType,
                network: printer.network ? { ...printer.network } : undefined,
                commands: result.commands,
                profile: result.profile,
                capabilities: result.capabilities,
                pulse: result.pulse ?? pulse,
                bytesSent: result.bytesSent,
                message: result.capabilities.mode === "REAL"
                    ? "Cash drawer pulse sent"
                    : "Cash drawer pulse simulated successfully",
                timestamp,
            };
            if (result.capabilities.mode === "REAL") {
                this.logsService.append({
                    source: "cash-drawer",
                    event: "cashdrawer.open.sent",
                    message: "Cash drawer pulse sent to configured printer",
                    metadata: this.buildMetadata(response, commandId, reason, profile.id),
                });
            }
            else {
                this.logsService.append({
                    source: "cash-drawer",
                    event: "cashdrawer.open.simulated",
                    message: "Cash drawer pulse simulated successfully without hardware",
                    metadata: this.buildMetadata(response, commandId, reason, profile.id),
                });
            }
            this.eventsService.emit(peripheral_types_1.PeripheralEventName.CashDrawerOpened, {
                terminalId,
                deviceId: printer.id,
                printerDeviceId: printer.id,
                connectionType: printer.connectionType,
                network: printer.network ? { ...printer.network } : undefined,
                commandId,
                reason,
                mode: result.capabilities.mode,
                profileId: result.profile.id,
                adapterName: result.adapterName,
                commandCount: result.commands.length,
                bytesSent: result.bytesSent,
                pulse,
                timestamp,
            });
            if (printer.connectionType === peripheral_types_1.ConnectionType.NETWORK) {
                this.devicesService.setRuntimeStatus(printer.id, peripheral_types_1.DeviceStatus.CONNECTED);
            }
            return response;
        }
        catch (error) {
            this.handleDrawerFailure(printer, terminalId, commandId, reason, profile.id, error);
            throw error;
        }
    }
    resolvePrinterDeviceId(record, terminalId) {
        const requestedPrinterDeviceId = (0, request_validation_util_1.optionalString)(record, "printerDeviceId", "").trim();
        if (requestedPrinterDeviceId) {
            const printer = this.findPrinterById(requestedPrinterDeviceId);
            if (!printer) {
                throw new common_1.NotFoundException("printer device not found");
            }
            return printer.id;
        }
        const legacyDeviceId = (0, request_validation_util_1.optionalString)(record, "deviceId", "").trim();
        if (legacyDeviceId) {
            const device = this.devicesService.findById(legacyDeviceId);
            if (!device) {
                throw new common_1.NotFoundException("printer device not found");
            }
            if (device.type === peripheral_types_1.DeviceType.PRINTER) {
                return device.id;
            }
            if (device.type === peripheral_types_1.DeviceType.CASH_DRAWER) {
                const printer = this.findBestPrinterForTerminal(device.terminalId);
                if (printer) {
                    return printer.id;
                }
            }
        }
        const terminalPrinter = this.findBestPrinterForTerminal(terminalId);
        if (terminalPrinter) {
            return terminalPrinter.id;
        }
        throw new common_1.NotFoundException("printer device not found");
    }
    findPrinterById(deviceId) {
        const device = this.devicesService.findById((0, request_validation_util_1.validateIdentifier)(deviceId, "printerDeviceId"));
        if (!device) {
            return undefined;
        }
        if (device.type !== peripheral_types_1.DeviceType.PRINTER) {
            throw new common_1.BadRequestException("printer device must be PRINTER");
        }
        return device;
    }
    findBestPrinterForTerminal(terminalId) {
        const printers = this.devicesService
            .list()
            .filter((device) => device.type === peripheral_types_1.DeviceType.PRINTER && device.terminalId === terminalId);
        return (printers.find((device) => device.connectionType !== peripheral_types_1.ConnectionType.MOCK &&
            device.status === peripheral_types_1.DeviceStatus.CONNECTED) ??
            printers.find((device) => device.connectionType !== peripheral_types_1.ConnectionType.MOCK) ??
            printers.find((device) => device.status === peripheral_types_1.DeviceStatus.CONNECTED) ??
            printers[0]);
    }
    buildPulseProfile(profileId) {
        if (profileId === "THERMAL_80MM" || profileId === "THERMAL_58MM") {
            return { ...thermal_escpos_renderer_1.DEFAULT_CASH_DRAWER_PULSE_PROFILE };
        }
        return { ...thermal_escpos_renderer_1.DEFAULT_CASH_DRAWER_PULSE_PROFILE };
    }
    isUsbDrawerPulseCertified(printer) {
        return printer.metadata?.usbRawCashDrawerPulseCertified === true;
    }
    buildMetadata(response, commandId, reason, profileId) {
        return {
            terminalId: response.terminalId,
            printerDeviceId: response.printerDeviceId,
            deviceId: response.deviceId,
            connectionType: response.connectionType,
            networkHost: response.network?.host,
            networkPort: response.network?.port,
            commandId,
            reason,
            profileId,
            adapterName: response.adapterName,
            mode: response.mode,
            commandCount: response.commands.length,
            bytesSent: response.bytesSent,
            pulse: response.pulse,
        };
    }
    handleDrawerFailure(printer, terminalId, commandId, reason, profileId, error) {
        const errorMessage = error instanceof Error ? error.message : "Cash drawer pulse failed";
        if (printer.connectionType === peripheral_types_1.ConnectionType.NETWORK) {
            this.devicesService.setRuntimeStatus(printer.id, peripheral_types_1.DeviceStatus.NOT_REACHABLE);
        }
        this.eventsService.emit(peripheral_types_1.PeripheralEventName.DeviceError, {
            terminalId,
            deviceId: printer.id,
            deviceType: printer.type,
            timestamp: new Date().toISOString(),
        });
        this.logsService.append({
            level: peripheral_types_1.LogLevel.ERROR,
            source: "cash-drawer",
            event: "cashdrawer.open.failed",
            message: "Cash drawer pulse failed",
            metadata: {
                terminalId,
                printerDeviceId: printer.id,
                deviceId: printer.id,
                connectionType: printer.connectionType,
                networkHost: printer.network?.host,
                networkPort: printer.network?.port,
                commandId,
                reason,
                profileId,
                errorMessage,
            },
        });
    }
    safeRecord(value, context) {
        try {
            return (0, request_validation_util_1.asRecord)(value, context);
        }
        catch (error) {
            this.logsService.append({
                level: peripheral_types_1.LogLevel.WARN,
                source: "cash-drawer",
                event: "cashdrawer.payload.invalid",
                message: "Cash drawer payload rejected by validation",
                metadata: { context },
            });
            throw error;
        }
    }
};
exports.CashDrawerService = CashDrawerService;
exports.CashDrawerService = CashDrawerService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(devices_service_1.DevicesService)),
    __param(1, (0, common_1.Inject)(logs_service_1.LogsService)),
    __param(2, (0, common_1.Inject)(events_service_1.EventsService)),
    __metadata("design:paramtypes", [devices_service_1.DevicesService,
        logs_service_1.LogsService,
        events_service_1.EventsService])
], CashDrawerService);
//# sourceMappingURL=cash-drawer.service.js.map