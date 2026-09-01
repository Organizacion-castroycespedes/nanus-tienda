"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTicketPrintDocument = exports.buildTestPrintDocument = exports.createCashDrawerPulseCommands = exports.createEscPosMockCommand = void 0;
const escpos_mock_types_1 = require("./escpos-mock.types");
const COMMAND_DESCRIPTIONS = {
    INIT: "Initialize printer",
    ALIGN_LEFT: "Left alignment",
    ALIGN_CENTER: "Center alignment",
    ALIGN_RIGHT: "Right alignment",
    BOLD_ON: "Bold mode on",
    BOLD_OFF: "Bold mode off",
    DOUBLE_HEIGHT_ON: "Double height mode on",
    DOUBLE_HEIGHT_OFF: "Double height mode off",
    FEED: "Feed paper",
    CUT: "Paper cut",
    CASH_DRAWER_PULSE: "Cash drawer pulse",
};
const createEscPosMockCommand = (name) => ({
    name,
    description: COMMAND_DESCRIPTIONS[name],
});
exports.createEscPosMockCommand = createEscPosMockCommand;
const createCashDrawerPulseCommands = () => [
    (0, exports.createEscPosMockCommand)(escpos_mock_types_1.EscPosMockCommandName.CashDrawerPulse),
];
exports.createCashDrawerPulseCommands = createCashDrawerPulseCommands;
const buildTestPrintDocument = (input) => {
    const writer = new ThermalTextWriter(input.widthChars);
    writer.center("MANUS POS");
    writer.center("PRUEBA DE IMPRESION");
    writer.separator();
    writer.pair("Modelo", input.printerName ?? "Impresora POS");
    writer.pair("Perfil", input.profileId ?? "-");
    writer.pair("Conexion", input.connectionType ?? "-");
    writer.pair("Terminal", input.terminalId);
    writer.pair("Device", input.deviceId);
    writer.pair("Agente", input.agentName);
    writer.pair("Modo", input.mode);
    writer.pair("Fecha", input.timestamp);
    writer.pair("Width", (input.paperWidthMm === null ? "generic" : input.paperWidthMm + "mm") +
        " / " +
        input.widthChars +
        " chars");
    writer.separator();
    writer.center("IMPRESION OK");
    writer.blank();
    writer.center("Conceptual cut below");
    writer.separator();
    return {
        preview: writer.toString(),
        commands: [
            (0, exports.createEscPosMockCommand)(escpos_mock_types_1.EscPosMockCommandName.Init),
            (0, exports.createEscPosMockCommand)(escpos_mock_types_1.EscPosMockCommandName.AlignCenter),
            (0, exports.createEscPosMockCommand)(escpos_mock_types_1.EscPosMockCommandName.BoldOn),
            (0, exports.createEscPosMockCommand)(escpos_mock_types_1.EscPosMockCommandName.DoubleHeightOn),
            (0, exports.createEscPosMockCommand)(escpos_mock_types_1.EscPosMockCommandName.DoubleHeightOff),
            (0, exports.createEscPosMockCommand)(escpos_mock_types_1.EscPosMockCommandName.BoldOff),
            (0, exports.createEscPosMockCommand)(escpos_mock_types_1.EscPosMockCommandName.AlignLeft),
            (0, exports.createEscPosMockCommand)(escpos_mock_types_1.EscPosMockCommandName.Feed),
            (0, exports.createEscPosMockCommand)(escpos_mock_types_1.EscPosMockCommandName.Cut),
        ],
        widthChars: input.widthChars,
    };
};
exports.buildTestPrintDocument = buildTestPrintDocument;
const buildTicketPrintDocument = (input) => {
    const writer = new ThermalTextWriter(input.widthChars);
    const content = input.content;
    const title = content.header || content.businessName || content.title || "Manus POS";
    writer.center(title);
    if (content.businessName && content.businessName !== title) {
        writer.center(content.businessName);
    }
    if (content.nit) {
        writer.center("NIT: " + content.nit);
    }
    if (content.address) {
        writer.center(content.address);
    }
    writer.separator();
    writer.pair("Tipo", input.ticketType);
    writer.pair("Fecha", content.date || input.timestamp);
    writer.pair("Terminal", input.terminalId);
    writer.pair("Device", input.deviceId);
    if (content.cashier) {
        writer.pair("Cajero", content.cashier);
    }
    if (content.documentNumber) {
        writer.pair("Documento", content.documentNumber);
    }
    if (content.saleNumber) {
        writer.pair("Venta", content.saleNumber);
    }
    writer.separator();
    if (content.items?.length) {
        writer.left("ITEMS");
        for (const item of content.items) {
            writer.left(item.name);
            const quantity = item.quantity ?? 1;
            const unitPrice = item.unitPrice === undefined ? "" : money(item.unitPrice);
            const total = item.total === undefined ? "" : money(item.total);
            writer.pair(quantity + " x " + unitPrice, total);
        }
        writer.separator();
    }
    if (content.lines?.length) {
        for (const line of content.lines) {
            writer.left(line);
        }
        writer.separator();
    }
    writer.amount("Subtotal", content.subtotal);
    writer.amount("Impuestos", content.taxes);
    writer.amount("Descuentos", content.discounts);
    if (content.total !== undefined) {
        writer.separator();
        writer.amount("TOTAL", content.total);
    }
    writer.amount("Pagado", content.paid);
    writer.amount("Cambio", content.change);
    writer.amount("Saldo", content.balance);
    if (content.payments?.length) {
        writer.separator();
        writer.left("PAGOS");
        for (const payment of content.payments) {
            writer.amount(payment.method, payment.amount);
        }
    }
    writer.separator();
    writer.center(content.footer || "Gracias por su compra");
    return {
        preview: writer.toString(),
        commands: [
            (0, exports.createEscPosMockCommand)(escpos_mock_types_1.EscPosMockCommandName.Init),
            (0, exports.createEscPosMockCommand)(escpos_mock_types_1.EscPosMockCommandName.AlignCenter),
            (0, exports.createEscPosMockCommand)(escpos_mock_types_1.EscPosMockCommandName.BoldOn),
            (0, exports.createEscPosMockCommand)(escpos_mock_types_1.EscPosMockCommandName.BoldOff),
            (0, exports.createEscPosMockCommand)(escpos_mock_types_1.EscPosMockCommandName.AlignLeft),
            (0, exports.createEscPosMockCommand)(escpos_mock_types_1.EscPosMockCommandName.AlignRight),
            (0, exports.createEscPosMockCommand)(escpos_mock_types_1.EscPosMockCommandName.Feed),
            (0, exports.createEscPosMockCommand)(escpos_mock_types_1.EscPosMockCommandName.Cut),
        ],
        widthChars: input.widthChars,
    };
};
exports.buildTicketPrintDocument = buildTicketPrintDocument;
class ThermalTextWriter {
    width;
    lines = [];
    constructor(width) {
        this.width = width;
    }
    center(value) {
        for (const line of wrapText(value, this.width)) {
            const padding = Math.max(0, Math.floor((this.width - line.length) / 2));
            this.lines.push(" ".repeat(padding) + line);
        }
    }
    left(value) {
        this.lines.push(...wrapText(value, this.width));
    }
    pair(label, value) {
        const cleanLabel = normalizeText(label);
        const cleanValue = normalizeText(value);
        if (!cleanLabel && !cleanValue) {
            return;
        }
        const gap = this.width - cleanLabel.length - cleanValue.length;
        if (gap > 1) {
            this.lines.push(cleanLabel + " ".repeat(gap) + cleanValue);
            return;
        }
        this.left(cleanLabel);
        for (const line of wrapText(cleanValue, this.width)) {
            this.lines.push(line.padStart(Math.min(this.width, line.length + 2)));
        }
    }
    amount(label, value) {
        if (value !== undefined) {
            this.pair(label, money(value));
        }
    }
    separator() {
        this.lines.push("-".repeat(this.width));
    }
    blank() {
        this.lines.push("");
    }
    toString() {
        return this.lines.join("\n");
    }
}
const normalizeText = (value) => value.replace(/\s+/g, " ").trim();
const wrapText = (value, width) => {
    const clean = normalizeText(value);
    if (!clean) {
        return [""];
    }
    const chunks = [];
    let current = "";
    for (const word of clean.split(" ")) {
        if (word.length > width) {
            if (current) {
                chunks.push(current);
                current = "";
            }
            for (let index = 0; index < word.length; index += width) {
                chunks.push(word.slice(index, index + width));
            }
            continue;
        }
        const next = current ? current + " " + word : word;
        if (next.length > width) {
            chunks.push(current);
            current = word;
        }
        else {
            current = next;
        }
    }
    if (current) {
        chunks.push(current);
    }
    return chunks;
};
const money = (value) => "$ " +
    new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
//# sourceMappingURL=thermal-ticket.formatter.js.map