import { Inject, Injectable } from "@nestjs/common";
import { FunctionRunnerService } from "../../database/function-runner.service";
import type {
  PurchaseTicketDataset,
  PurchasesReportListDataset,
  ReportActorContext,
} from "../types/purchases-report.types";

type PurchasesListParams = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
};

@Injectable()
export class PurchasesReportAdapter {
  constructor(
    @Inject(FunctionRunnerService)
    private readonly functionRunnerService: FunctionRunnerService
  ) {}

  async getPurchasesList(
    actor: ReportActorContext,
    filters: PurchasesListParams
  ): Promise<PurchasesReportListDataset | null> {
    return this.functionRunnerService.executeFunction<PurchasesReportListDataset | null>(
      "report_purchases",
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

  async getPurchaseTicket(
    actor: ReportActorContext,
    purchaseId: string
  ): Promise<PurchaseTicketDataset | null> {
    return this.functionRunnerService.executeFunction<PurchaseTicketDataset | null>(
      "report_purchase_ticket",
      [actor.userId, actor.role, actor.tenantId, actor.branchId, purchaseId]
    );
  }
}
