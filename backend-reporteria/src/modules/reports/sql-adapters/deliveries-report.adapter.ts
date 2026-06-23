import { Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import type {
  DeliveryTicketDataset,
  ReportActorContext,
} from "../types/deliveries-report.types";

type DeliveryTicketRow = {
  delivery_id: string;
  delivery_number: string;
  tenant_name: string | null;
  branch_name: string | null;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
  dispatched_at: string | Date | null;
  delivered_at: string | Date | null;
  failed_at: string | Date | null;
  cancelled_at: string | Date | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_document_number: string | null;
  delivery_address: string;
  delivery_reference: string | null;
  order_id: string | null;
  order_status: string | null;
  order_created_at: string | Date | null;
  order_total: string | number | null;
  sale_id: string | null;
  sale_status: string | null;
  sale_payment_status: string | null;
  sale_created_at: string | Date | null;
  sale_total: string | number | null;
  driver_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  driver_document_number: string | null;
  driver_active: boolean | null;
  payment_method_id: string | null;
  payment_method_name: string | null;
  payment_method_type: string | null;
  delivery_fee: string | number;
  subtotal: string | number;
  total: string | number;
  notes: string | null;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
};

const toIso = (value: string | Date | null | undefined) =>
  value instanceof Date ? value.toISOString() : value ?? null;

const toNumber = (value: string | number | null | undefined) =>
  value === null || value === undefined ? null : Number(value);

@Injectable()
export class DeliveriesReportAdapter {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private async hasDriverCatalogSchema() {
    const result = await this.databaseService.query<{
      has_driver_table: boolean;
      has_driver_column: boolean;
    }>(
      `
        SELECT
          EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'delivery_drivers'
          ) AS has_driver_table,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'deliveries'
              AND column_name = 'driver_id'
          ) AS has_driver_column
      `
    );

    const row = result.rows[0];
    return Boolean(row?.has_driver_table && row?.has_driver_column);
  }

  private mapTicketRow(row: DeliveryTicketRow): DeliveryTicketDataset {
    const driver = row.driver_id
      ? {
          id: row.driver_id,
          name: row.driver_name,
          phone: row.driver_phone,
          documentNumber: row.driver_document_number,
          active: row.driver_active,
        }
      : null;

    return {
      header: {
        deliveryId: row.delivery_id,
        deliveryNumber: row.delivery_number,
        tenantName: row.tenant_name,
        branchName: row.branch_name,
        status: row.status,
        createdAt: toIso(row.created_at) ?? "",
        updatedAt: toIso(row.updated_at) ?? "",
        dispatchedAt: toIso(row.dispatched_at),
        deliveredAt: toIso(row.delivered_at),
        failedAt: toIso(row.failed_at),
        cancelledAt: toIso(row.cancelled_at),
      },
      customer: {
        customerId: row.customer_id,
        name: row.customer_name,
        phone: row.customer_phone,
        documentNumber: row.customer_document_number,
      },
      address: {
        value: row.delivery_address,
        reference: row.delivery_reference,
      },
      source: {
        orderId: row.order_id,
        orderStatus: row.order_status,
        orderDate: toIso(row.order_created_at),
        orderTotal: toNumber(row.order_total),
        saleId: row.sale_id,
        saleStatus: row.sale_status,
        salePaymentStatus: row.sale_payment_status,
        saleDate: toIso(row.sale_created_at),
        saleTotal: toNumber(row.sale_total),
      },
      driver,
      payment: row.payment_method_id
        ? {
            methodId: row.payment_method_id,
            methodName: row.payment_method_name,
            methodType: row.payment_method_type,
          }
        : null,
      totals: {
        deliveryFee: Number(row.delivery_fee ?? 0),
        sourceSubtotal: Number(row.subtotal ?? 0),
        total: Number(row.total ?? 0),
      },
      notes: row.notes,
      createdByUserId: row.created_by_user_id,
      updatedByUserId: row.updated_by_user_id,
    };
  }

  async getDeliveryTicket(
    actor: ReportActorContext,
    deliveryId: string
  ): Promise<DeliveryTicketDataset | null> {
    const hasDriverCatalog = await this.hasDriverCatalogSchema();
    const driverFields = hasDriverCatalog
      ? `
          driver.id AS driver_id,
          driver.name AS driver_name,
          driver.phone AS driver_phone,
          driver.document_number AS driver_document_number,
          driver.active AS driver_active`
      : `
          NULL::uuid AS driver_id,
          NULL::text AS driver_name,
          NULL::text AS driver_phone,
          NULL::text AS driver_document_number,
          NULL::boolean AS driver_active`;
    const driverJoin = hasDriverCatalog
      ? `
        LEFT JOIN public.delivery_drivers driver
          ON driver.id = d.driver_id
          AND driver.tenant_id = d.tenant_id`
      : "";
    const params: unknown[] = [deliveryId, actor.tenantId];
    const branchCondition = actor.branchId
      ? (() => {
          params.push(actor.branchId);
          return `AND d.branch_id = $${params.length}`;
        })()
      : "";

    const result = await this.databaseService.query<DeliveryTicketRow>(
      `
        SELECT
          d.id AS delivery_id,
          d.delivery_number,
          tenant.nombre AS tenant_name,
          branch.nombre AS branch_name,
          d.status,
          d.created_at,
          d.updated_at,
          d.dispatched_at,
          d.delivered_at,
          d.failed_at,
          d.cancelled_at,
          d.customer_id,
          COALESCE(NULLIF(d.customer_name, ''), customer.name) AS customer_name,
          COALESCE(NULLIF(d.customer_phone, ''), customer.phone) AS customer_phone,
          customer.document_number AS customer_document_number,
          d.delivery_address,
          d.delivery_reference,
          d.order_id,
          orders.status AS order_status,
          orders.created_at AS order_created_at,
          orders.total AS order_total,
          d.sale_id,
          sales.status AS sale_status,
          sales.payment_status AS sale_payment_status,
          sales.created_at AS sale_created_at,
          sales.total AS sale_total,
${driverFields},
          d.payment_method_id,
          payment_method.nombre AS payment_method_name,
          payment_method.tipo AS payment_method_type,
          d.delivery_fee,
          d.subtotal,
          d.total,
          d.notes,
          d.created_by_user_id,
          d.updated_by_user_id
        FROM public.deliveries d
        LEFT JOIN public.tenants tenant
          ON tenant.id = d.tenant_id
        LEFT JOIN public.tenant_branches branch
          ON branch.id = d.branch_id
          AND branch.tenant_id = d.tenant_id
        LEFT JOIN public.customers customer
          ON customer.id = d.customer_id
          AND customer.tenant_id = d.tenant_id
        LEFT JOIN public.orders orders
          ON orders.id = d.order_id
          AND orders.tenant_id = d.tenant_id
        LEFT JOIN public.sales sales
          ON sales.id = d.sale_id
          AND sales.tenant_id = d.tenant_id
        LEFT JOIN public.payment_methods payment_method
          ON payment_method.id = d.payment_method_id
          AND payment_method.tenant_id = d.tenant_id
${driverJoin}
        WHERE d.id = $1
          AND d.tenant_id = $2
          ${branchCondition}
        LIMIT 1
      `,
      params
    );

    const row = result.rows[0];
    return row ? this.mapTicketRow(row) : null;
  }

  async deliveryExists(deliveryId: string): Promise<boolean> {
    const result = await this.databaseService.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM public.deliveries WHERE id = $1) AS exists",
      [deliveryId]
    );
    return result.rows[0]?.exists === true;
  }
}
