import { Inject, Injectable } from "@nestjs/common";
import { FunctionRunnerService } from "../../database/function-runner.service";
import type {
  CustomerOrdersStatusDataset,
  ReportActorContext,
} from "../types/customers-report.types";

type CustomersListParams = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
};

@Injectable()
export class CustomersReportAdapter {
  constructor(
    @Inject(FunctionRunnerService)
    private readonly functionRunnerService: FunctionRunnerService
  ) {}

  async getCustomerOrdersStatus(
    actor: ReportActorContext,
    filters: CustomersListParams
  ): Promise<CustomerOrdersStatusDataset | null> {
    return this.functionRunnerService.executeFunction<CustomerOrdersStatusDataset | null>(
      "report_customer_orders_status",
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
}
