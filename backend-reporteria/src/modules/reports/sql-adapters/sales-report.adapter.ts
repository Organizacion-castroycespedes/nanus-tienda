import { Inject, Injectable } from "@nestjs/common";
import { FunctionRunnerService } from "../../database/function-runner.service";
import type {
  PosSaleCancelTicketDataset,
  PosSaleTicketDataset,
  PosSalesListDataset,
  ReportActorContext,
} from "../types/sales-report.types";

type SalesListParams = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
};

@Injectable()
export class SalesReportAdapter {
  constructor(
    @Inject(FunctionRunnerService)
    private readonly functionRunnerService: FunctionRunnerService
  ) {}

  async getSalesList(
    actor: ReportActorContext,
    filters: SalesListParams
  ): Promise<PosSalesListDataset | null> {
    return this.functionRunnerService.executeFunction<PosSalesListDataset | null>(
      "report_pos_sales",
      [
        actor.userId,
        actor.role,
        actor.tenantId,
        actor.branchId,
        filters.tenantId ?? null,
        filters.branchId ?? null,
        filters.dateFrom ?? null,
        filters.dateTo ?? null,
      ]
    );
  }

  async getSaleTicket(
    actor: ReportActorContext,
    saleId: string
  ): Promise<PosSaleTicketDataset | null> {
    return this.functionRunnerService.executeFunction<PosSaleTicketDataset | null>(
      "report_pos_sale_ticket",
      [actor.userId, actor.role, actor.tenantId, actor.branchId, saleId]
    );
  }

  async getSaleCancelTicket(
    actor: ReportActorContext,
    saleId: string
  ): Promise<PosSaleCancelTicketDataset | null> {
    return this.functionRunnerService.executeFunction<PosSaleCancelTicketDataset | null>(
      "report_pos_sale_cancel_ticket",
      [actor.userId, actor.role, actor.tenantId, actor.branchId, saleId]
    );
  }
}
