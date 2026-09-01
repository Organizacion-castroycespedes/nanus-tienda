"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScaleModule = void 0;
const common_1 = require("@nestjs/common");
const devices_module_1 = require("../devices/devices.module");
const scale_controller_1 = require("./scale.controller");
const scale_service_1 = require("./scale.service");
let ScaleModule = class ScaleModule {
};
exports.ScaleModule = ScaleModule;
exports.ScaleModule = ScaleModule = __decorate([
    (0, common_1.Module)({
        imports: [devices_module_1.DevicesModule],
        controllers: [scale_controller_1.ScaleController],
        providers: [scale_service_1.ScaleService],
    })
], ScaleModule);
//# sourceMappingURL=scale.module.js.map