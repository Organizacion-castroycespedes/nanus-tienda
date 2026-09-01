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
exports.ScaleService = void 0;
const common_1 = require("@nestjs/common");
const peripheral_types_1 = require("../../shared/types/peripheral.types");
const request_validation_util_1 = require("../../shared/utils/request-validation.util");
const devices_service_1 = require("../devices/devices.service");
const events_service_1 = require("../events/events.service");
const logs_service_1 = require("../logs/logs.service");
const DEFAULT_TERMINAL_ID = "local-terminal";
const DEFAULT_SCALE_ID = "mock-scale-001";
const MOCK_WEIGHT_KG = 1.25;
let ScaleService = class ScaleService {
    devicesService;
    logsService;
    eventsService;
    constructor(devicesService, logsService, eventsService) {
        this.devicesService = devicesService;
        this.logsService = logsService;
        this.eventsService = eventsService;
    }
    getCurrentWeight(request) {
        const terminalId = (0, request_validation_util_1.validateIdentifier)(request.terminalId?.trim() || DEFAULT_TERMINAL_ID, "terminalId");
        const deviceId = (0, request_validation_util_1.validateIdentifier)(request.deviceId?.trim() || DEFAULT_SCALE_ID, "deviceId");
        const scale = this.devicesService.findRequired(deviceId, peripheral_types_1.DeviceType.SCALE);
        const timestamp = new Date().toISOString();
        const response = {
            deviceId: scale.id,
            weight: MOCK_WEIGHT_KG,
            unit: "kg",
            stable: true,
            timestamp,
        };
        this.eventsService.emit(peripheral_types_1.PeripheralEventName.ScaleWeightChanged, {
            terminalId,
            deviceId: scale.id,
            weight: response.weight,
            unit: response.unit,
            stable: response.stable,
            timestamp,
        });
        this.logsService.append({
            source: "scale",
            event: "scale.current_weight.simulated",
            message: "Scale current weight simulated successfully",
            metadata: {
                terminalId,
                deviceId: scale.id,
                weight: response.weight,
                unit: response.unit,
                stable: response.stable,
            },
        });
        return response;
    }
};
exports.ScaleService = ScaleService;
exports.ScaleService = ScaleService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(devices_service_1.DevicesService)),
    __param(1, (0, common_1.Inject)(logs_service_1.LogsService)),
    __param(2, (0, common_1.Inject)(events_service_1.EventsService)),
    __metadata("design:paramtypes", [devices_service_1.DevicesService,
        logs_service_1.LogsService,
        events_service_1.EventsService])
], ScaleService);
//# sourceMappingURL=scale.service.js.map