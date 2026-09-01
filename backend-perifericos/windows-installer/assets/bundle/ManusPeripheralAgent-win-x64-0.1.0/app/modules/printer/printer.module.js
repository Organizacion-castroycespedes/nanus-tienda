"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrinterModule = void 0;
const common_1 = require("@nestjs/common");
const devices_module_1 = require("../devices/devices.module");
const printer_controller_1 = require("./printer.controller");
const printer_service_1 = require("./printer.service");
let PrinterModule = class PrinterModule {
};
exports.PrinterModule = PrinterModule;
exports.PrinterModule = PrinterModule = __decorate([
    (0, common_1.Module)({
        imports: [devices_module_1.DevicesModule],
        controllers: [printer_controller_1.PrinterController],
        providers: [printer_service_1.PrinterService],
        exports: [printer_service_1.PrinterService],
    })
], PrinterModule);
//# sourceMappingURL=printer.module.js.map