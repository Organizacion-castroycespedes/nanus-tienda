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
exports.ScaleController = void 0;
const common_1 = require("@nestjs/common");
const scale_service_1 = require("./scale.service");
let ScaleController = class ScaleController {
    scaleService;
    constructor(scaleService) {
        this.scaleService = scaleService;
    }
    getCurrentWeight(terminalId, deviceId) {
        return this.scaleService.getCurrentWeight({ terminalId, deviceId });
    }
};
exports.ScaleController = ScaleController;
__decorate([
    (0, common_1.Get)("current-weight"),
    __param(0, (0, common_1.Query)("terminalId")),
    __param(1, (0, common_1.Query)("deviceId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Object)
], ScaleController.prototype, "getCurrentWeight", null);
exports.ScaleController = ScaleController = __decorate([
    (0, common_1.Controller)("scale"),
    __param(0, (0, common_1.Inject)(scale_service_1.ScaleService)),
    __metadata("design:paramtypes", [scale_service_1.ScaleService])
], ScaleController);
//# sourceMappingURL=scale.controller.js.map