"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const cash_drawer_module_1 = require("./modules/cash-drawer/cash-drawer.module");
const devices_module_1 = require("./modules/devices/devices.module");
const events_module_1 = require("./modules/events/events.module");
const health_module_1 = require("./modules/health/health.module");
const logs_module_1 = require("./modules/logs/logs.module");
const printer_module_1 = require("./modules/printer/printer.module");
const scale_module_1 = require("./modules/scale/scale.module");
const scanner_module_1 = require("./modules/scanner/scanner.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            events_module_1.EventsModule,
            logs_module_1.LogsModule,
            health_module_1.HealthModule,
            devices_module_1.DevicesModule,
            printer_module_1.PrinterModule,
            cash_drawer_module_1.CashDrawerModule,
            scale_module_1.ScaleModule,
            scanner_module_1.ScannerModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map