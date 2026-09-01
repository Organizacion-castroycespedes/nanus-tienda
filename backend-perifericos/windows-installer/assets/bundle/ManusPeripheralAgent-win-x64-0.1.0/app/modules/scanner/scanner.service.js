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
exports.ScannerService = void 0;
const common_1 = require("@nestjs/common");
const peripheral_types_1 = require("../../shared/types/peripheral.types");
const request_validation_util_1 = require("../../shared/utils/request-validation.util");
const devices_service_1 = require("../devices/devices.service");
const events_service_1 = require("../events/events.service");
const logs_service_1 = require("../logs/logs.service");
const DEFAULT_TERMINAL_ID = "local-terminal";
const DEFAULT_SCANNER_ID = "mock-scanner-001";
let ScannerService = class ScannerService {
    devicesService;
    logsService;
    eventsService;
    constructor(devicesService, logsService, eventsService) {
        this.devicesService = devicesService;
        this.logsService = logsService;
        this.eventsService = eventsService;
    }
    simulate(request) {
        const record = this.safeRecord(request, "scanner payload");
        const terminalId = (0, request_validation_util_1.validateIdentifier)((0, request_validation_util_1.optionalString)(record, "terminalId", DEFAULT_TERMINAL_ID), "terminalId");
        const deviceId = (0, request_validation_util_1.validateIdentifier)((0, request_validation_util_1.optionalString)(record, "deviceId", DEFAULT_SCANNER_ID), "deviceId");
        const code = (0, request_validation_util_1.optionalString)(record, "code", "");
        const format = (0, request_validation_util_1.validateFormat)((0, request_validation_util_1.optionalString)(record, "format", "UNKNOWN"), "format");
        if (!code) {
            this.logsService.append({
                level: peripheral_types_1.LogLevel.WARN,
                source: "scanner",
                event: "scanner.code_read.rejected",
                message: "Scanner simulation rejected because code is required",
                metadata: { terminalId, deviceId, format },
            });
            throw new common_1.BadRequestException("code is required");
        }
        (0, request_validation_util_1.validateCode)(code);
        const scanner = this.devicesService.findRequired(deviceId, peripheral_types_1.DeviceType.SCANNER);
        const timestamp = new Date().toISOString();
        this.eventsService.emit(peripheral_types_1.PeripheralEventName.ScannerCodeRead, {
            terminalId,
            deviceId: scanner.id,
            code,
            format,
            timestamp,
        });
        this.logsService.append({
            source: "scanner",
            event: "scanner.code_read.simulated",
            message: "Scanner code read simulated successfully",
            metadata: {
                terminalId,
                deviceId: scanner.id,
                code,
                format,
            },
        });
        return {
            success: true,
            code,
            format,
            timestamp,
        };
    }
    safeRecord(value, context) {
        try {
            return (0, request_validation_util_1.asRecord)(value, context);
        }
        catch (error) {
            this.logsService.append({
                level: peripheral_types_1.LogLevel.WARN,
                source: "scanner",
                event: "scanner.payload.invalid",
                message: "Scanner payload rejected by validation",
                metadata: { context },
            });
            throw error;
        }
    }
};
exports.ScannerService = ScannerService;
exports.ScannerService = ScannerService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(devices_service_1.DevicesService)),
    __param(1, (0, common_1.Inject)(logs_service_1.LogsService)),
    __param(2, (0, common_1.Inject)(events_service_1.EventsService)),
    __metadata("design:paramtypes", [devices_service_1.DevicesService,
        logs_service_1.LogsService,
        events_service_1.EventsService])
], ScannerService);
//# sourceMappingURL=scanner.service.js.map