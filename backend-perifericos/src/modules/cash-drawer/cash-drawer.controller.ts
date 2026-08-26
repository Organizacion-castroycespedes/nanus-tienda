import { Body, Controller, Inject, Post } from "@nestjs/common";
import { CashDrawerService } from "./cash-drawer.service";
import type {
  CashDrawerOpenRequest,
  CashDrawerOpenResponse,
} from "./cash-drawer.types";

@Controller("cash-drawer")
export class CashDrawerController {
  constructor(
    @Inject(CashDrawerService)
    private readonly cashDrawerService: CashDrawerService
  ) {}

  @Post("open")
  open(@Body() body: CashDrawerOpenRequest): Promise<CashDrawerOpenResponse> {
    return this.cashDrawerService.open(body);
  }
}
