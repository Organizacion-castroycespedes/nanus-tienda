"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.containsPhysicalCut = exports.renderThermalEscPos = exports.THERMAL_80MM_SAFE_WIDTH_CHARS = exports.DEFAULT_CASH_DRAWER_PULSE_PROFILE = void 0;
exports.buildCashDrawerPulseBytes = buildCashDrawerPulseBytes;
exports.renderCashDrawerPulseEscPos = renderCashDrawerPulseEscPos;
const escpos_mock_types_1 = require("../escpos-mock/escpos-mock.types");
exports.DEFAULT_CASH_DRAWER_PULSE_PROFILE = {
    connector: 0,
    pin: 2,
    pulseOnMs: 50,
    pulseOffMs: 250,
};
const normalizeEscPosByte = (value) => {
    if (!Number.isFinite(value)) {
        return 0;
    }
    const rounded = Math.round(value);
    if (rounded < 0) {
        return 0;
    }
    if (rounded > 255) {
        return 255;
    }
    return rounded;
};
function buildCashDrawerPulseBytes(pulse = exports.DEFAULT_CASH_DRAWER_PULSE_PROFILE) {
    const connector = normalizeEscPosByte(pulse.connector);
    const pulseOnMs = normalizeEscPosByte(pulse.pulseOnMs);
    const pulseOffMs = normalizeEscPosByte(pulse.pulseOffMs);
    return Buffer.from([0x1b, 0x70, connector, pulseOnMs, pulseOffMs]);
}
function renderCashDrawerPulseEscPos(pulse = exports.DEFAULT_CASH_DRAWER_PULSE_PROFILE) {
    return buildCashDrawerPulseBytes(pulse);
}
const commandBytes = {
    INIT: Buffer.from([0x1b, 0x40]),
    ALIGN_LEFT: Buffer.from([0x1b, 0x61, 0x00]),
    ALIGN_CENTER: Buffer.from([0x1b, 0x61, 0x01]),
    ALIGN_RIGHT: Buffer.from([0x1b, 0x61, 0x02]),
    BOLD_ON: Buffer.from([0x1b, 0x45, 0x01]),
    BOLD_OFF: Buffer.from([0x1b, 0x45, 0x00]),
    DOUBLE_HEIGHT_ON: Buffer.from([0x1d, 0x21, 0x01]),
    DOUBLE_HEIGHT_OFF: Buffer.from([0x1d, 0x21, 0x00]),
    FEED: Buffer.from([0x1b, 0x64, 0x06]),
    CUT: Buffer.from([0x1d, 0x56, 0x00]),
    CASH_DRAWER_PULSE: buildCashDrawerPulseBytes(exports.DEFAULT_CASH_DRAWER_PULSE_PROFILE),
};
exports.THERMAL_80MM_SAFE_WIDTH_CHARS = 48;
const renderThermalEscPos = (commands, preview, options) => {
    const prefix = [];
    const suffix = [];
    for (const command of commands) {
        if (command.name === escpos_mock_types_1.EscPosMockCommandName.Cut && !options.includePhysicalCut) {
            continue;
        }
        const target = command.name === escpos_mock_types_1.EscPosMockCommandName.Feed ||
            command.name === escpos_mock_types_1.EscPosMockCommandName.Cut
            ? suffix
            : prefix;
        target.push(commandBytes[command.name]);
    }
    return Buffer.concat([
        ...prefix,
        Buffer.from(preview + "\n", options.encoding ?? "latin1"),
        ...suffix,
    ]);
};
exports.renderThermalEscPos = renderThermalEscPos;
const containsPhysicalCut = (payload) => payload.includes(commandBytes[escpos_mock_types_1.EscPosMockCommandName.Cut]);
exports.containsPhysicalCut = containsPhysicalCut;
//# sourceMappingURL=thermal-escpos.renderer.js.map