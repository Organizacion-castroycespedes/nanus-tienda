"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SanitizedHttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
let SanitizedHttpExceptionFilter = class SanitizedHttpExceptionFilter {
    catch(exception, host) {
        const response = host.switchToHttp().getResponse();
        const status = exception instanceof common_1.HttpException
            ? exception.getStatus()
            : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        const payload = {
            statusCode: status,
            error: this.getErrorName(exception, status),
            message: this.getMessage(exception),
            timestamp: new Date().toISOString(),
        };
        response.status(status).json(payload);
    }
    getErrorName(exception, status) {
        if (exception instanceof common_1.HttpException) {
            const response = exception.getResponse();
            if (response &&
                typeof response === "object" &&
                "error" in response &&
                typeof response.error === "string") {
                return response.error;
            }
        }
        return status >= 500 ? "Internal Server Error" : "Request Error";
    }
    getMessage(exception) {
        if (exception instanceof common_1.HttpException) {
            const response = exception.getResponse();
            if (typeof response === "string") {
                return response;
            }
            if (response &&
                typeof response === "object" &&
                "message" in response) {
                const message = response.message;
                return Array.isArray(message) ? message.join("; ") : String(message);
            }
            return exception.message;
        }
        return "Internal server error";
    }
};
exports.SanitizedHttpExceptionFilter = SanitizedHttpExceptionFilter;
exports.SanitizedHttpExceptionFilter = SanitizedHttpExceptionFilter = __decorate([
    (0, common_1.Catch)()
], SanitizedHttpExceptionFilter);
//# sourceMappingURL=sanitized-http-exception.filter.js.map