import { Body, Controller, Inject, Post } from "@nestjs/common";
import { PrinterService } from "./printer.service";
import type {
  PrintTicketRequest,
  PrinterJobResponse,
  TestPrintRequest,
} from "./printer.types";

@Controller("printer")
export class PrinterController {
  constructor(
    @Inject(PrinterService) private readonly printerService: PrinterService
  ) {}

  @Post("test-print")
  testPrint(@Body() body: TestPrintRequest): Promise<PrinterJobResponse> {
    return this.printerService.testPrint(body);
  }

  @Post("print-ticket")
  printTicket(@Body() body: PrintTicketRequest): Promise<PrinterJobResponse> {
    return this.printerService.printTicket(body);
  }
}
