import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";

type SanitizedErrorResponse = {
  statusCode: number;
  error: string;
  message: string;
  timestamp: string;
};

@Catch()
export class SanitizedHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload: SanitizedErrorResponse = {
      statusCode: status,
      error: this.getErrorName(exception, status),
      message: this.getMessage(exception),
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(payload);
  }

  private getErrorName(exception: unknown, status: number): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (
        response &&
        typeof response === "object" &&
        "error" in response &&
        typeof response.error === "string"
      ) {
        return response.error;
      }
    }

    return status >= 500 ? "Internal Server Error" : "Request Error";
  }

  private getMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === "string") {
        return response;
      }
      if (
        response &&
        typeof response === "object" &&
        "message" in response
      ) {
        const message = response.message;
        return Array.isArray(message) ? message.join("; ") : String(message);
      }

      return exception.message;
    }

    return "Internal server error";
  }
}
