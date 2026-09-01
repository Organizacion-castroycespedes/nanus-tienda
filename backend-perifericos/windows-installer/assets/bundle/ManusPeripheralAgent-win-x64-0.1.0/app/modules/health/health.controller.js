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
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const agent_installation_state_store_1 = require("../../platform/agent-installation-state.store");
const devices_service_1 = require("../devices/devices.service");
const peripherals_config_1 = require("../../shared/config/peripherals.config");
let HealthController = class HealthController {
    devicesService;
    constructor(devicesService) {
        this.devicesService = devicesService;
    }
    getHealth() {
        const config = (0, peripherals_config_1.getPeripheralsConfig)();
        const runtime = this.devicesService.getHealthSnapshot();
        return {
            status: "ok",
            agent: config.agentName,
            mode: config.mode,
            agentInstallationId: (0, agent_installation_state_store_1.getAgentInstallationId)(),
            platform: process.platform,
            architecture: process.arch,
            version: config.version,
            uptimeSeconds: Math.max(0, Math.floor((Date.now() - config.startedAt) / 1000)),
            configuredDevices: runtime.configuredDevices,
            discoveredDevices: runtime.discoveredDevices,
            persistenceState: {
                schemaVersion: runtime.schemaVersion,
                status: runtime.persistenceState,
            },
        };
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], HealthController.prototype, "getHealth", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)("health"),
    __param(0, (0, common_1.Inject)(devices_service_1.DevicesService)),
    __metadata("design:paramtypes", [devices_service_1.DevicesService])
], HealthController);
//# sourceMappingURL=health.controller.js.map