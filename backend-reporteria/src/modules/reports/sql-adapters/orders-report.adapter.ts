import { Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { FunctionRunnerService } from "../../database/function-runner.service";
import type {
  OrderSaleTicketDataset,
  OrderSalesListDataset,
  ReportActorContext,
} from "../types/orders-report.types";

type OrdersListParams = {
  tenantId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
};

@Injectable()
export class OrdersReportAdapter {
  constructor(
    @Inject(FunctionRunnerService)
    private readonly functionRunnerService: FunctionRunnerService,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  async getOrderSalesList(
    actor: ReportActorContext,
    filters: OrdersListParams
  ): Promise<OrderSalesListDataset | null> {
    return this.functionRunnerService.executeFunction<OrderSalesListDataset | null>(
      "report_orders_sales",
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

  async getOrderSaleTicket(
    actor: ReportActorContext,
    orderId: string
  ): Promise<OrderSaleTicketDataset | null> {
    return this.functionRunnerService.executeFunction<OrderSaleTicketDataset | null>(
      "report_order_sale_ticket",
      [actor.userId, actor.role, actor.tenantId, actor.branchId, orderId]
    );
  }

  async orderSaleExists(orderId: string): Promise<boolean> {
    const result = await this.databaseService.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM orders WHERE id = $1) AS exists",
      [orderId]
    );
    return result.rows[0]?.exists === true;
  }
}
