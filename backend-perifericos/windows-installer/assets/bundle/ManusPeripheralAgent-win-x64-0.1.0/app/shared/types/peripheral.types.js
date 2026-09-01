"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeripheralEventName = exports.LogLevel = exports.ConnectionType = exports.DeviceStatus = exports.DeviceType = void 0;
var DeviceType;
(function (DeviceType) {
    DeviceType["PRINTER"] = "PRINTER";
    DeviceType["CASH_DRAWER"] = "CASH_DRAWER";
    DeviceType["SCALE"] = "SCALE";
    DeviceType["SCANNER"] = "SCANNER";
    DeviceType["DISPLAY"] = "DISPLAY";
    DeviceType["OTHER"] = "OTHER";
})(DeviceType || (exports.DeviceType = DeviceType = {}));
var DeviceStatus;
(function (DeviceStatus) {
    DeviceStatus["CONNECTED"] = "CONNECTED";
    DeviceStatus["DISCONNECTED"] = "DISCONNECTED";
    DeviceStatus["NOT_REACHABLE"] = "NOT_REACHABLE";
    DeviceStatus["ERROR"] = "ERROR";
    DeviceStatus["SIMULATED"] = "SIMULATED";
})(DeviceStatus || (exports.DeviceStatus = DeviceStatus = {}));
var ConnectionType;
(function (ConnectionType) {
    ConnectionType["MOCK"] = "MOCK";
    ConnectionType["USB"] = "USB";
    ConnectionType["SERIAL"] = "SERIAL";
    ConnectionType["HID"] = "HID";
    ConnectionType["USB_HID"] = "USB_HID";
    ConnectionType["NETWORK"] = "NETWORK";
    ConnectionType["BLUETOOTH"] = "BLUETOOTH";
})(ConnectionType || (exports.ConnectionType = ConnectionType = {}));
var LogLevel;
(function (LogLevel) {
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
exports.PeripheralEventName = {
    DeviceConnected: "device.connected",
    DeviceDisconnected: "device.disconnected",
    DeviceError: "device.error",
    PrinterJobStarted: "printer.job.started",
    PrinterJobCompleted: "printer.job.completed",
    PrinterJobFailed: "printer.job.failed",
    CashDrawerOpened: "cashdrawer.opened",
    ScaleWeightChanged: "scale.weight.changed",
    ScannerCodeRead: "scanner.code.read",
    AgentHealthChanged: "agent.health.changed",
};
//# sourceMappingURL=peripheral.types.js.map