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
exports.PrinterService = void 0;
const common_1 = require("@nestjs/common");
const peripheral_types_1 = require("../../shared/types/peripheral.types");
const peripherals_config_1 = require("../../shared/config/peripherals.config");
const peripheral_adapter_resolver_1 = require("../../shared/adapters/peripheral-adapter.resolver");
const id_util_1 = require("../../shared/utils/id.util");
const request_validation_util_1 = require("../../shared/utils/request-validation.util");
const devices_service_1 = require("../devices/devices.service");
const events_service_1 = require("../events/events.service");
const logs_service_1 = require("../logs/logs.service");
const DEFAULT_TERMINAL_ID = "local-terminal";
const DEFAULT_PRINTER_ID = "mock-printer-001";
let PrinterService = class PrinterService {
    devicesService;
    logsService;
    eventsService;
    adapterResolver = new peripheral_adapter_resolver_1.PeripheralAdapterResolver();
    constructor(devicesService, logsService, eventsService) {
        this.devicesService = devicesService;
        this.logsService = logsService;
        this.eventsService = eventsService;
    }
    async testPrint(request) {
        const record = this.safeRecord(request, "test print payload");
        const terminalId = (0, request_validation_util_1.validateIdentifier)((0, request_validation_util_1.optionalString)(record, "terminalId", DEFAULT_TERMINAL_ID), "terminalId");
        const deviceId = (0, request_validation_util_1.validateIdentifier)((0, request_validation_util_1.optionalString)(record, "deviceId", DEFAULT_PRINTER_ID), "deviceId");
        const printer = this.devicesService.findRequired(deviceId, peripheral_types_1.DeviceType.PRINTER);
        const config = (0, peripherals_config_1.getPeripheralsConfig)();
        const profile = this.adapterResolver.resolveProfile(printer);
        const adapter = this.adapterResolver.resolvePrinter(printer, config.mode);
        const jobId = (0, id_util_1.createId)(adapter.mode === "REAL" ? "real-print-job" : "mock-print-job");
        const timestamp = new Date().toISOString();
        let result;
        try {
            this.devicesService.assertUsbPrinterAvailable(printer);
            result = await adapter.printTest({
                agentName: config.agentName,
                mode: adapter.mode,
                terminalId,
                device: printer,
                profile,
                jobId,
                timestamp,
            });
        }
        catch (error) {
            this.recordPrintFailure({
                terminalId,
                deviceId: printer.id,
                jobId,
                ticketType: "TEST_PRINT",
                profileId: profile.id,
                adapterName: adapter.adapterName,
                mode: adapter.mode,
                event: "printer.test_print.failed",
                error,
            });
            this.devicesService.setRuntimeStatus(printer.id, printer.connectionType === peripheral_types_1.ConnectionType.NETWORK
                ? peripheral_types_1.DeviceStatus.NOT_REACHABLE
                : peripheral_types_1.DeviceStatus.DISCONNECTED);
            throw error;
        }
        const mode = result.capabilities.mode;
        const metadata = {
            terminalId,
            deviceId: printer.id,
            jobId,
            ticketType: "TEST_PRINT",
            profileId: result.profile.id,
            adapterName: result.adapterName,
            mode,
            commandCount: result.commands.length,
            previewLength: result.preview.length,
            widthChars: result.profile.widthChars,
            bytesSent: result.bytesSent,
        };
        this.eventsService.emit(peripheral_types_1.PeripheralEventName.PrinterJobStarted, {
            terminalId,
            deviceId: printer.id,
            jobId,
            jobType: "TEST_PRINT",
            mode,
            profileId: result.profile.id,
            adapterName: result.adapterName,
            commandCount: result.commands.length,
            previewAvailable: true,
            bytesSent: result.bytesSent,
            timestamp,
        });
        this.logsService.append({
            source: "printer",
            event: "printer.test_print.started",
            message: mode === "REAL"
                ? "Test print job started"
                : "Test print simulation started",
            metadata,
        });
        this.eventsService.emit(peripheral_types_1.PeripheralEventName.PrinterJobCompleted, {
            terminalId,
            deviceId: printer.id,
            jobId,
            jobType: "TEST_PRINT",
            mode,
            profileId: result.profile.id,
            adapterName: result.adapterName,
            commandCount: result.commands.length,
            previewAvailable: true,
            bytesSent: result.bytesSent,
            timestamp: new Date().toISOString(),
        });
        this.logsService.append({
            source: "printer",
            event: mode === "REAL"
                ? "printer.test_print.sent"
                : "printer.test_print.simulated",
            message: mode === "REAL"
                ? "Test print sent to configured printer"
                : "Test print simulated successfully",
            metadata,
        });
        this.logsService.append({
            source: "printer",
            event: mode === "REAL"
                ? "printer.test_print.sent"
                : "printer.test_print.simulated",
            message: mode === "REAL"
                ? "Test print sent to configured printer"
                : "Test print simulated successfully",
            metadata,
        });
        this.logsService.append({
            source: "printer",
            event: "print.sent",
            message: "Print job completed successfully",
            metadata,
        });
        this.devicesService.setRuntimeStatus(printer.id, peripheral_types_1.DeviceStatus.CONNECTED);
        return {
            success: true,
            jobId,
            mode,
            adapterName: result.adapterName,
            deviceId: printer.id,
            terminalId,
            network: printer.network ? { ...printer.network } : undefined,
            preview: result.preview,
            commands: result.commands,
            profile: result.profile,
            capabilities: result.capabilities,
            bytesSent: result.bytesSent,
            message: mode === "REAL"
                ? "Print job sent to configured printer"
                : "Test print simulated successfully",
        };
    }
    async printTicket(request) {
        const record = this.safeRecord(request, "ticket print payload");
        const terminalId = (0, request_validation_util_1.validateIdentifier)((0, request_validation_util_1.optionalString)(record, "terminalId", DEFAULT_TERMINAL_ID), "terminalId");
        const deviceId = (0, request_validation_util_1.validateIdentifier)((0, request_validation_util_1.optionalString)(record, "deviceId", DEFAULT_PRINTER_ID), "deviceId");
        const ticketType = (0, request_validation_util_1.validateIdentifier)((0, request_validation_util_1.optionalString)(record, "ticketType", "GENERIC"), "ticketType");
        const printer = this.devicesService.findRequired(deviceId, peripheral_types_1.DeviceType.PRINTER);
        const config = (0, peripherals_config_1.getPeripheralsConfig)();
        const profile = this.adapterResolver.resolveProfile(printer);
        const adapter = this.adapterResolver.resolvePrinter(printer, config.mode);
        const jobId = (0, id_util_1.createId)(adapter.mode === "REAL" ? "real-ticket-job" : "mock-ticket-job");
        if (!record.content || typeof record.content !== "object") {
            this.logsService.append({
                level: peripheral_types_1.LogLevel.WARN,
                source: "printer",
                event: "printer.ticket_print.rejected",
                message: "Ticket print rejected because content is invalid",
                metadata: { terminalId, deviceId, ticketType },
            });
            throw new common_1.BadRequestException("content is required");
        }
        const content = this.parseTicketContent(record.content);
        const timestamp = new Date().toISOString();
        let result;
        try {
            this.devicesService.assertUsbPrinterAvailable(printer);
            result = await adapter.printTicket({
                agentName: config.agentName,
                ticketType,
                terminalId,
                device: printer,
                content,
                mode: adapter.mode,
                profile,
                jobId,
                timestamp,
            });
        }
        catch (error) {
            this.recordPrintFailure({
                terminalId,
                deviceId: printer.id,
                jobId,
                ticketType,
                profileId: profile.id,
                adapterName: adapter.adapterName,
                mode: adapter.mode,
                event: "printer.ticket_print.failed",
                error,
            });
            this.devicesService.setRuntimeStatus(printer.id, printer.connectionType === peripheral_types_1.ConnectionType.NETWORK
                ? peripheral_types_1.DeviceStatus.NOT_REACHABLE
                : peripheral_types_1.DeviceStatus.DISCONNECTED);
            throw error;
        }
        const mode = result.capabilities.mode;
        const metadata = {
            terminalId,
            deviceId: printer.id,
            jobId,
            ticketType,
            profileId: result.profile.id,
            adapterName: result.adapterName,
            mode,
            commandCount: result.commands.length,
            previewLength: result.preview.length,
            widthChars: result.profile.widthChars,
            bytesSent: result.bytesSent,
            itemCount: content.items?.length ?? 0,
            paymentCount: content.payments?.length ?? 0,
            lineCount: content.lines?.length ?? 0,
        };
        this.eventsService.emit(peripheral_types_1.PeripheralEventName.PrinterJobStarted, {
            terminalId,
            deviceId: printer.id,
            jobId,
            ticketType,
            mode,
            profileId: result.profile.id,
            adapterName: result.adapterName,
            commandCount: result.commands.length,
            previewAvailable: true,
            bytesSent: result.bytesSent,
            timestamp,
        });
        this.logsService.append({
            source: "printer",
            event: "printer.ticket_print.started",
            message: mode === "REAL"
                ? "Ticket print job started"
                : "Ticket print simulation started",
            metadata,
        });
        this.eventsService.emit(peripheral_types_1.PeripheralEventName.PrinterJobCompleted, {
            terminalId,
            deviceId: printer.id,
            jobId,
            ticketType,
            mode,
            profileId: result.profile.id,
            adapterName: result.adapterName,
            commandCount: result.commands.length,
            previewAvailable: true,
            bytesSent: result.bytesSent,
            timestamp: new Date().toISOString(),
        });
        this.logsService.append({
            source: "printer",
            event: mode === "REAL"
                ? "printer.ticket_print.sent"
                : "printer.ticket_print.simulated",
            message: mode === "REAL"
                ? "Ticket print sent to configured printer"
                : "Ticket print simulated successfully",
            metadata,
        });
        this.logsService.append({
            source: "printer",
            event: mode === "REAL"
                ? "printer.ticket_print.sent"
                : "printer.ticket_print.simulated",
            message: mode === "REAL"
                ? "Ticket print sent to configured printer"
                : "Ticket print simulated successfully",
            metadata,
        });
        this.logsService.append({
            source: "printer",
            event: "print.sent",
            message: "Print job completed successfully",
            metadata,
        });
        this.devicesService.setRuntimeStatus(printer.id, peripheral_types_1.DeviceStatus.CONNECTED);
        return {
            success: true,
            jobId,
            mode,
            adapterName: result.adapterName,
            deviceId: printer.id,
            terminalId,
            network: printer.network ? { ...printer.network } : undefined,
            preview: result.preview,
            commands: result.commands,
            profile: result.profile,
            capabilities: result.capabilities,
            bytesSent: result.bytesSent,
            message: mode === "REAL"
                ? "Print job sent to configured printer"
                : "Ticket print simulated successfully",
        };
    }
    recordPrintFailure(input) {
        const errorMessage = input.error instanceof Error ? input.error.message : "Printer job failed";
        const timestamp = new Date().toISOString();
        const metadata = {
            terminalId: input.terminalId,
            deviceId: input.deviceId,
            jobId: input.jobId,
            ticketType: input.ticketType,
            profileId: input.profileId,
            adapterName: input.adapterName,
            mode: input.mode,
            errorMessage,
        };
        this.eventsService.emit(peripheral_types_1.PeripheralEventName.PrinterJobFailed, {
            terminalId: input.terminalId,
            deviceId: input.deviceId,
            jobId: input.jobId,
            ticketType: input.ticketType,
            mode: input.mode,
            profileId: input.profileId,
            adapterName: input.adapterName,
            timestamp,
        });
        this.logsService.append({
            level: peripheral_types_1.LogLevel.ERROR,
            source: "printer",
            event: input.event,
            message: "Printer job failed with controlled error",
            metadata,
        });
        this.logsService.append({
            level: peripheral_types_1.LogLevel.ERROR,
            source: "printer",
            event: "print.failed",
            message: "Print job failed",
            metadata,
        });
    }
    parseTicketContent(value) {
        const record = (0, request_validation_util_1.asRecord)(value, "content");
        const lines = parseLines(record.lines);
        const items = parseItems(record.items);
        const payments = parsePayments(record.payments);
        return {
            header: optionalTicketText(record, "header"),
            businessName: optionalTicketText(record, "businessName"),
            nit: optionalTicketText(record, "nit") ?? optionalTicketText(record, "taxId"),
            address: optionalTicketText(record, "address"),
            cashier: optionalTicketText(record, "cashier"),
            documentNumber: optionalTicketText(record, "documentNumber"),
            saleNumber: optionalTicketText(record, "saleNumber"),
            date: optionalTicketText(record, "date"),
            footer: optionalTicketText(record, "footer"),
            title: optionalTicketText(record, "title"),
            lines,
            items,
            subtotal: optionalTicketNumber(record, "subtotal"),
            taxes: optionalTicketNumber(record, "taxes"),
            discounts: optionalTicketNumber(record, "discounts"),
            total: optionalTicketNumber(record, "total"),
            paid: optionalTicketNumber(record, "paid"),
            change: optionalTicketNumber(record, "change"),
            balance: optionalTicketNumber(record, "balance"),
            payments,
        };
    }
    safeRecord(value, context) {
        try {
            return (0, request_validation_util_1.asRecord)(value, context);
        }
        catch (error) {
            this.logsService.append({
                level: peripheral_types_1.LogLevel.WARN,
                source: "printer",
                event: "printer.payload.invalid",
                message: "Printer payload rejected by validation",
                metadata: { context },
            });
            throw error;
        }
    }
};
exports.PrinterService = PrinterService;
exports.PrinterService = PrinterService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(devices_service_1.DevicesService)),
    __param(1, (0, common_1.Inject)(logs_service_1.LogsService)),
    __param(2, (0, common_1.Inject)(events_service_1.EventsService)),
    __metadata("design:paramtypes", [devices_service_1.DevicesService,
        logs_service_1.LogsService,
        events_service_1.EventsService])
], PrinterService);
const optionalTicketText = (record, field, maxLength = 200) => {
    if (!(field in record) || record[field] === undefined || record[field] === null) {
        return undefined;
    }
    const value = record[field];
    if (typeof value !== "string") {
        throw new common_1.BadRequestException(`content.${field} must be a string`);
    }
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (!trimmed) {
        return undefined;
    }
    if (trimmed.length > maxLength) {
        throw new common_1.BadRequestException(`content.${field} is too long`);
    }
    return trimmed;
};
const optionalTicketNumber = (record, field) => {
    if (!(field in record) || record[field] === undefined || record[field] === null) {
        return undefined;
    }
    const value = record[field];
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new common_1.BadRequestException(`content.${field} must be a finite number`);
    }
    return value;
};
const parseLines = (value) => {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (!Array.isArray(value) ||
        value.some((line) => typeof line !== "string")) {
        throw new common_1.BadRequestException("content.lines must be an array of strings");
    }
    if (value.length > 100) {
        throw new common_1.BadRequestException("content.lines cannot exceed 100 items");
    }
    return value
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean);
};
const parseItems = (value) => {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (!Array.isArray(value)) {
        throw new common_1.BadRequestException("content.items must be an array");
    }
    if (value.length > 100) {
        throw new common_1.BadRequestException("content.items cannot exceed 100 items");
    }
    return value.map((item, index) => {
        const record = (0, request_validation_util_1.asRecord)(item, `content.items[${index}]`);
        const name = optionalTicketText(record, "name", 200);
        if (!name) {
            throw new common_1.BadRequestException(`content.items[${index}].name is required`);
        }
        return {
            name,
            quantity: optionalTicketNumber(record, "quantity"),
            unitPrice: optionalTicketNumber(record, "unitPrice"),
            total: optionalTicketNumber(record, "total"),
        };
    });
};
const parsePayments = (value) => {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (!Array.isArray(value)) {
        throw new common_1.BadRequestException("content.payments must be an array");
    }
    if (value.length > 20) {
        throw new common_1.BadRequestException("content.payments cannot exceed 20 items");
    }
    return value.map((payment, index) => {
        const record = (0, request_validation_util_1.asRecord)(payment, `content.payments[${index}]`);
        const method = optionalTicketText(record, "method", 80);
        if (!method) {
            throw new common_1.BadRequestException(`content.payments[${index}].method is required`);
        }
        return {
            method,
            amount: optionalTicketNumber(record, "amount"),
        };
    });
};
//# sourceMappingURL=printer.service.js.map