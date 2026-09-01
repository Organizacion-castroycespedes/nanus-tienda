"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CashDrawerModule = void 0;
const common_1 = require("@nestjs/common");
const devices_module_1 = require("../devices/devices.module");
const cash_drawer_controller_1 = require("./cash-drawer.controller");
const cash_drawer_service_1 = require("./cash-drawer.service");
let CashDrawerModule = class CashDrawerModule {
};
exports.CashDrawerModule = CashDrawerModule;
exports.CashDrawerModule = CashDrawerModule = __decorate([
    (0, common_1.Module)({
        imports: [devices_module_1.DevicesModule],
        controllers: [cash_drawer_controller_1.CashDrawerController],
        providers: [cash_drawer_service_1.CashDrawerService],
    })
], CashDrawerModule);
//# sourceMappingURL=cash-drawer.module.js.map