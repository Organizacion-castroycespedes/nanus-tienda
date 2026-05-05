import { Inject, Injectable } from "@nestjs/common";
import { FunctionRunnerService } from "../../database/function-runner.service";
import type {
  CashAuditListDataset,
  CashAuditTicketDataset,
  CashClosingListDataset,
  CashClosingTicketDataset,
  ReportActorContext,
} from "../types/cash-report.types";

type CashListParams = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
};

@Injectable()
export class CashReportAdapter {
  constructor(
    @Inject(FunctionRunnerService)
    private readonly functionRunnerService: FunctionRunnerService
  ) {}

  async getCashClosingsList(
    actor: ReportActorContext,
    filters: CashListParams
  ): Promise<CashClosingListDataset | null> {
    return this.functionRunnerService.executeFunction<CashClosingListDataset | null>(
      "report_cash_closings",
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

  async getCashClosingTicket(
    actor: ReportActorContext,
    cashSessionId: string
  ): Promise<CashClosingTicketDataset | null> {
    return this.functionRunnerService.executeFunction<CashClosingTicketDataset | null>(
      "report_cash_closing_ticket",
      [actor.userId, actor.role, actor.tenantId, actor.branchId, cashSessionId]
    );
  }

  async getCashAuditList(
    actor: ReportActorContext,
    filters: CashListParams
  ): Promise<CashAuditListDataset | null> {
    return this.functionRunnerService.executeFunction<CashAuditListDataset | null>(
      "report_cash_audit",
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

  async getCashAuditTicket(
    actor: ReportActorContext,
    cashCountId: string
  ): Promise<CashAuditTicketDataset | null> {
    return this.functionRunnerService.executeFunction<CashAuditTicketDataset | null>(
      "report_cash_audit_ticket",
      [actor.userId, actor.role, actor.tenantId, actor.branchId, cashCountId]
    );
  }
}
