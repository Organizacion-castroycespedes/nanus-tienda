import { Body, Controller, Inject, Post } from "@nestjs/common";
import { ScannerService } from "./scanner.service";
import type {
  ScannerSimulateRequest,
  ScannerSimulateResponse,
} from "./scanner.types";

@Controller("scanner")
export class ScannerController {
  constructor(
    @Inject(ScannerService) private readonly scannerService: ScannerService
  ) {}

  @Post("simulate")
  simulate(@Body() body: ScannerSimulateRequest): ScannerSimulateResponse {
    return this.scannerService.simulate(body);
  }
}
