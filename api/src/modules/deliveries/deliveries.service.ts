import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../common/db/database.service";
import {
  getDeliveryStatusFilterValues,
  normalizeDeliveryStatus,
  toStoredDeliveryStatus,
  type DeliveryAction,
  type DeliveryStatus,
} from "./deliveries.constants";
import { AssignDeliveryDto } from "./dto/assign-delivery.dto";
import { CancelDeliveryDto } from "./dto/cancel-delivery.dto";
import { CreateDeliveryDto } from "./dto/create-delivery.dto";
import { CreateOrderDeliveryDto } from "./dto/create-order-delivery.dto";
import { CreateSaleDeliveryDto } from "./dto/create-sale-delivery.dto";
import { DispatchDeliveryDto } from "./dto/dispatch-delivery.dto";
import { MarkDeliveredDeliveryDto } from "./dto/mark-delivered-delivery.dto";
import { MarkNotDeliveredDeliveryDto } from "./dto/mark-not-delivered-delivery.dto";
import { QueryDeliveriesDto } from "./dto/query-deliveries.dto";
import { UpdateDeliveryDto } from "./dto/update-delivery.dto";
import { DeliveryNumberService } from "./services/delivery-number.service";
import { DeliveryStateMachineService } from "./services/delivery-state-machine.service";
import { AssignDeliveryDriverDto } from "./dto/assign-delivery-driver.dto";

type DeliveryActor = {
  tenantId?: string;
  userId?: string;
  roles: string[];
  branchId?: string;
  terminalId?: string;
  posSessionId?: string;
};

type DeliveryRecord = {
  id: string;
  tenant_id: string;
  branch_id: string;
  customer_id: string | null;
  order_id: string | null;
  sale_id: string | null;
  delivery_number: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string;
  delivery_reference: string | null;
  delivery_fee: string | number;
  subtotal: string | number;
  total: string | number;
  payment_method_id: string | null;
  assigned_courier_id: string | null;
  driver_id: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  driver_document_number?: string | null;
  driver_active?: boolean | null;
  cash_session_id?: string | null;
  cash_register_id?: string | null;
  terminal_id?: string | null;
  cash_impact_amount?: string | number | null;
  cash_impact_recorded_at?: Date | string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  dispatched_at: Date | string | null;
  cancelled_at: Date | string | null;
  delivered_at: Date | string | null;
  failed_at: Date | string | null;
  total_count?: string | number;
};

type OrderDeliverySourceRecord = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  order_total: string | number | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  branch_id: string | null;
};

type SaleDeliverySourceRecord = {
  id: string;
  tenant_id: string;
  branch_id: string;
  customer_id: string;
  order_id: string | null;
  total: string | number | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
};

type DeliveryCashSchema = {
  has_cash_columns: boolean;
  has_cash_tables: boolean;
};

type DeliveryCashContext = {
  cashSessionId: string;
  cashRegisterId: string;
  terminalId: string | null;
  cashImpactAmount: number;
  recordedAt: Date;
};

const DELIVERY_SELECT_FIELDS = `
          d.id,
          d.tenant_id,
          d.branch_id,
          d.customer_id,
          d.order_id,
          d.sale_id,
          d.delivery_number,
          d.status,
          d.customer_name,
          d.customer_phone,
          d.delivery_address,
          d.delivery_reference,
          d.delivery_fee,
          d.subtotal,
          d.total,
          d.payment_method_id,
          d.assigned_courier_id,
          d.driver_id,
          driver.name AS driver_name,
          driver.phone AS driver_phone,
          driver.document_number AS driver_document_number,
          driver.active AS driver_active,
          d.notes,
          d.metadata,
          d.created_by_user_id,
          d.updated_by_user_id,
          d.created_at,
          d.updated_at,
          d.dispatched_at,
          d.cancelled_at,
          d.delivered_at,
          d.failed_at
`;

const DELIVERY_SELECT_FIELDS_WITHOUT_DRIVER = `
          d.id,
          d.tenant_id,
          d.branch_id,
          d.customer_id,
          d.order_id,
          d.sale_id,
          d.delivery_number,
          d.status,
          d.customer_name,
          d.customer_phone,
          d.delivery_address,
          d.delivery_reference,
          d.delivery_fee,
          d.subtotal,
          d.total,
          d.payment_method_id,
          d.assigned_courier_id,
          NULL::uuid AS driver_id,
          NULL::text AS driver_name,
          NULL::text AS driver_phone,
          NULL::text AS driver_document_number,
          NULL::boolean AS driver_active,
          d.notes,
          d.metadata,
          d.created_by_user_id,
          d.updated_by_user_id,
          d.created_at,
          d.updated_at,
          d.dispatched_at,
          d.cancelled_at,
          d.delivered_at,
          d.failed_at
`;

const DELIVERY_CASH_SELECT_FIELDS = `,
          d.cash_session_id,
          d.cash_register_id,
          d.terminal_id,
          d.cash_impact_amount,
          d.cash_impact_recorded_at
`;

const DELIVERY_CASH_SELECT_FIELDS_PENDING_MIGRATION = `,
          NULL::uuid AS cash_session_id,
          NULL::uuid AS cash_register_id,
          NULL::uuid AS terminal_id,
          0::numeric AS cash_impact_amount,
          NULL::timestamptz AS cash_impact_recorded_at
`;

type TransitionOptions = {
  action: DeliveryAction;
  nextStatus: DeliveryStatus;
  reason?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  extraHistoryMetadata?: Record<string, unknown>;
  beforeUpdate?: (delivery: DeliveryRecord) => void;
  buildAssignments?: (
    params: unknown[],
    assignments: string[],
    delivery: DeliveryRecord
  ) => void;
};

@Injectable()
export class DeliveriesService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(DeliveryNumberService)
    private readonly deliveryNumberService: DeliveryNumberService,
    @Inject(DeliveryStateMachineService)
    private readonly stateMachine: DeliveryStateMachineService
  ) {}

  private resolveTenantId(actor: DeliveryActor) {
    const tenantId = actor.tenantId?.trim();
    if (!tenantId) {
      throw new UnauthorizedException("Tenant no encontrado en la sesion");
    }
    return tenantId;
  }

  private resolveBranchId(actor: DeliveryActor, requestedBranchId?: string) {
    const contextBranchId = actor.branchId?.trim();
    const bodyBranchId = requestedBranchId?.trim();

    if (contextBranchId && bodyBranchId && contextBranchId !== bodyBranchId) {
      throw new ForbiddenException("No autorizado para otra sucursal");
    }

    return contextBranchId || bodyBranchId || null;
  }

  private normalizeNullableText(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private normalizeRequiredText(value: string, message: string) {
    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException(message);
    }
    return normalized;
  }

  private normalizeAmount(value: number | undefined, defaultValue = 0) {
    const amount = Number(value ?? defaultValue);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException("Valores monetarios invalidos");
    }
    return Number(amount.toFixed(2));
  }

  private normalizeMetadata(value: Record<string, unknown> | undefined) {
    if (value === undefined) {
      return {};
    }

    if (value === null || Array.isArray(value) || typeof value !== "object") {
      throw new BadRequestException("Metadata debe ser un objeto JSON");
    }

    return value;
  }

  private async hasDriverCatalogSchema() {
    const result = await this.db.query<{
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

  private async hasCashScopeSchema(): Promise<DeliveryCashSchema> {
    const result = await this.db.query<DeliveryCashSchema>(
      `
        SELECT
          (
            SELECT COUNT(*) = 5
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'deliveries'
              AND column_name IN (
                'cash_session_id',
                'cash_register_id',
                'terminal_id',
                'cash_impact_amount',
                'cash_impact_recorded_at'
              )
          ) AS has_cash_columns,
          (
            to_regclass('public.cash_sessions') IS NOT NULL
            AND to_regclass('public.cash_registers') IS NOT NULL
          ) AS has_cash_tables
      `
    );

    const row = result.rows[0];
    return {
      has_cash_columns: Boolean(row?.has_cash_columns),
      has_cash_tables: Boolean(row?.has_cash_tables),
    };
  }

  private getDeliverySelect(
    hasDriverCatalog: boolean,
    hasCashScope: boolean
  ) {
    const cashFields = hasCashScope
      ? DELIVERY_CASH_SELECT_FIELDS
      : DELIVERY_CASH_SELECT_FIELDS_PENDING_MIGRATION;

    return hasDriverCatalog
      ? {
          fields: `${DELIVERY_SELECT_FIELDS}${cashFields}`,
          join: `
        LEFT JOIN public.delivery_drivers driver
          ON driver.id = d.driver_id
          AND driver.tenant_id = d.tenant_id`,
        }
      : {
          fields: `${DELIVERY_SELECT_FIELDS_WITHOUT_DRIVER}${cashFields}`,
          join: "",
        };
  }

  private mapRecord(record: DeliveryRecord) {
    return {
      id: record.id,
      tenant_id: record.tenant_id,
      branch_id: record.branch_id,
      customer_id: record.customer_id,
      order_id: record.order_id,
      sale_id: record.sale_id,
      delivery_number: record.delivery_number,
      status: normalizeDeliveryStatus(record.status) ?? record.status,
      customer_name: record.customer_name,
      customer_phone: record.customer_phone,
      delivery_address: record.delivery_address,
      delivery_reference: record.delivery_reference,
      delivery_fee: Number(record.delivery_fee),
      subtotal: Number(record.subtotal),
      total: Number(record.total),
      payment_method_id: record.payment_method_id,
      assigned_courier_id: record.assigned_courier_id,
      driver_id: record.driver_id ?? null,
      driver: record.driver_id
        ? {
            id: record.driver_id,
            name: record.driver_name ?? null,
            phone: record.driver_phone ?? null,
            document_number: record.driver_document_number ?? null,
            active: record.driver_active ?? null,
          }
        : null,
      cash_session_id: record.cash_session_id ?? null,
      cash_register_id: record.cash_register_id ?? null,
      terminal_id: record.terminal_id ?? null,
      cash_impact_amount: Number(record.cash_impact_amount ?? 0),
      cash_impact_recorded_at: record.cash_impact_recorded_at ?? null,
      notes: record.notes,
      metadata: record.metadata ?? {},
      created_by_user_id: record.created_by_user_id,
      updated_by_user_id: record.updated_by_user_id,
      created_at: record.created_at,
      updated_at: record.updated_at,
      dispatched_at: record.dispatched_at,
      cancelled_at: record.cancelled_at,
      delivered_at: record.delivered_at,
      failed_at: record.failed_at,
    };
  }

  private async assertBranchScope(tenantId: string, branchId: string) {
    const result = await this.db.query<{ id: string }>(
      `
        SELECT id
        FROM public.tenant_branches
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1
      `,
      [branchId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new BadRequestException("Sucursal invalida para el tenant");
    }
  }

  private async assertCustomerScope(tenantId: string, customerId?: string) {
    if (!customerId) {
      return;
    }

    const result = await this.db.query<{ id: string }>(
      `
        SELECT id
        FROM public.customers
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1
      `,
      [customerId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new BadRequestException("Cliente invalido para el tenant");
    }
  }

  private async assertOrderScope(tenantId: string, orderId?: string) {
    if (!orderId) {
      return;
    }

    const result = await this.db.query<{ id: string }>(
      `
        SELECT id
        FROM public.orders
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1
      `,
      [orderId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new BadRequestException("Pedido invalido para el tenant");
    }
  }

  private async loadOrderForDelivery(orderId: string, tenantId: string) {
    const result = await this.db.query<OrderDeliverySourceRecord>(
      `
        SELECT
          o.id,
          o.tenant_id,
          o.customer_id,
          o.total AS order_total,
          c.name AS customer_name,
          c.phone AS customer_phone,
          c.address AS customer_address,
          order_context.branch_id
        FROM public.orders o
        LEFT JOIN public.customers c
          ON c.id = o.customer_id
          AND c.tenant_id = o.tenant_id
        LEFT JOIN LATERAL (
          SELECT NULLIF(ae.datos_despues->>'branchId', '')::text AS branch_id
          FROM public.auditoria_eventos ae
          WHERE ae.tenant_id = o.tenant_id
            AND ae.entidad = 'orders'
            AND ae.entidad_id = o.id::text
            AND ae.accion IN ('ORDER_CREATED', 'ORDER_UPDATED')
          ORDER BY ae.created_at DESC, ae.id DESC
          LIMIT 1
        ) order_context ON TRUE
        WHERE o.id = $1
          AND o.tenant_id = $2
        LIMIT 1
      `,
      [orderId, tenantId]
    );

    const order = result.rows[0];
    if (!order) {
      throw new NotFoundException("Pedido no encontrado");
    }

    return order;
  }

  private async loadSaleForDelivery(saleId: string, tenantId: string) {
    const result = await this.db.query<SaleDeliverySourceRecord>(
      `
        SELECT
          s.id,
          s.tenant_id,
          s.branch_id,
          s.customer_id,
          s.order_id,
          s.total,
          c.name AS customer_name,
          c.phone AS customer_phone,
          c.address AS customer_address
        FROM public.sales s
        LEFT JOIN public.customers c
          ON c.id = s.customer_id
          AND c.tenant_id = s.tenant_id
        WHERE s.id = $1
          AND s.tenant_id = $2
        LIMIT 1
      `,
      [saleId, tenantId]
    );

    const sale = result.rows[0];
    if (!sale) {
      throw new NotFoundException("Factura no encontrada");
    }

    return sale;
  }

  private resolveOrderDeliveryBranch(
    order: OrderDeliverySourceRecord,
    actor: DeliveryActor,
    requestedBranchId?: string
  ) {
    const orderBranchId = this.normalizeNullableText(order.branch_id);
    const actorBranchId = this.normalizeNullableText(actor.branchId);
    const bodyBranchId = this.normalizeNullableText(requestedBranchId);

    if (orderBranchId && actorBranchId && orderBranchId !== actorBranchId) {
      throw new ForbiddenException("No autorizado para la sucursal del pedido");
    }

    if (orderBranchId && bodyBranchId && orderBranchId !== bodyBranchId) {
      throw new BadRequestException("branch_id no coincide con el pedido");
    }

    if (!orderBranchId && actorBranchId && bodyBranchId && actorBranchId !== bodyBranchId) {
      throw new ForbiddenException("No autorizado para otra sucursal");
    }

    const branchId = orderBranchId || actorBranchId || bodyBranchId;
    if (!branchId) {
      throw new BadRequestException("branch_id es requerido");
    }

    return branchId;
  }

  private resolveSaleDeliveryBranch(
    sale: SaleDeliverySourceRecord,
    actor: DeliveryActor
  ) {
    const saleBranchId = this.normalizeNullableText(sale.branch_id);
    const actorBranchId = this.normalizeNullableText(actor.branchId);

    if (saleBranchId && actorBranchId && saleBranchId !== actorBranchId) {
      throw new ForbiddenException("No autorizado para la sucursal de la factura");
    }

    if (!saleBranchId) {
      throw new BadRequestException("branch_id es requerido");
    }

    return saleBranchId;
  }

  private async lockOrderForDelivery(
    client: PoolClient,
    tenantId: string,
    orderId: string
  ) {
    const result = await client.query<{ id: string }>(
      `
        SELECT id
        FROM public.orders
        WHERE id = $1
          AND tenant_id = $2
        FOR UPDATE
      `,
      [orderId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new BadRequestException("Pedido invalido para el tenant");
    }
  }

  private async lockSaleForDelivery(
    client: PoolClient,
    tenantId: string,
    saleId: string
  ) {
    const result = await client.query<{ id: string }>(
      `
        SELECT id
        FROM public.sales
        WHERE id = $1
          AND tenant_id = $2
        FOR UPDATE
      `,
      [saleId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException("Factura no encontrada");
    }
  }

  private async assertNoOrderDelivery(
    client: PoolClient,
    tenantId: string,
    orderId: string
  ) {
    const result = await client.query<{ id: string; status: string }>(
      `
        SELECT id, status
        FROM public.deliveries
        WHERE tenant_id = $1
          AND order_id = $2
        LIMIT 1
      `,
      [tenantId, orderId]
    );

    if (result.rows[0]) {
      throw new BadRequestException("El pedido ya tiene un domicilio asociado");
    }
  }

  private async assertNoSaleDelivery(
    client: PoolClient,
    tenantId: string,
    saleId: string,
    orderId?: string | null
  ) {
    const params: unknown[] = [tenantId, saleId];
    const relationConditions = ["sale_id = $2"];

    if (orderId) {
      params.push(orderId);
      relationConditions.push(`order_id = $${params.length}`);
    }

    const result = await client.query<{ id: string; status: string }>(
      `
        SELECT id, status
        FROM public.deliveries
        WHERE tenant_id = $1
          AND (${relationConditions.join(" OR ")})
        LIMIT 1
      `,
      params
    );

    if (result.rows[0]) {
      throw new BadRequestException(
        "La factura ya tiene un domicilio asociado"
      );
    }
  }

  private async assertSaleScope(
    tenantId: string,
    branchId: string,
    saleId?: string
  ) {
    if (!saleId) {
      return;
    }

    const result = await this.db.query<{ id: string; branch_id: string }>(
      `
        SELECT id, branch_id
        FROM public.sales
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1
      `,
      [saleId, tenantId]
    );

    const sale = result.rows[0];
    if (!sale) {
      throw new BadRequestException("Venta invalida para el tenant");
    }
    if (sale.branch_id !== branchId) {
      throw new BadRequestException("La venta no pertenece a la sucursal");
    }
  }

  private async assertPaymentMethodScope(
    tenantId: string,
    paymentMethodId?: string | null
  ) {
    if (!paymentMethodId) {
      return;
    }

    const result = await this.db.query<{ id: string }>(
      `
        SELECT id
        FROM public.payment_methods
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1
      `,
      [paymentMethodId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new BadRequestException("Metodo de pago invalido para el tenant");
    }
  }

  private async assertUserScope(tenantId: string, userId?: string | null) {
    if (!userId) {
      return;
    }

    const result = await this.db.query<{ id: string }>(
      `
        SELECT id
        FROM public.users
        WHERE id = $1
          AND tenant_id = $2
          AND estado = 'ACTIVE'
        LIMIT 1
      `,
      [userId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new BadRequestException("Usuario invalido para el tenant");
    }
  }

  private isAdminCashScope(actor: DeliveryActor) {
    return actor.roles.some((role) =>
      ["SUPER_ADMIN", "SUPER_USER", "ADMIN"].includes(role.toUpperCase())
    );
  }

  private hasDeliveryCashImpact(
    deliveryFee: number | string | null | undefined,
    paymentMethodId?: string | null
  ) {
    return Number(deliveryFee ?? 0) > 0 || Boolean(paymentMethodId);
  }

  private async queryCurrentCashContext(
    tenantId: string,
    branchId: string,
    actor: DeliveryActor,
    cashImpactAmount: number,
    client?: PoolClient
  ): Promise<DeliveryCashContext | null> {
    if (!actor.userId) {
      throw new UnauthorizedException("Usuario no encontrado en la sesion");
    }

    const params: unknown[] = [tenantId, actor.userId, branchId];
    const conditions = [
      "session.tenant_id = $1",
      "session.opened_by_user_id = $2",
      "session.branch_id = $3",
      "session.status = 'OPEN'",
    ];

    if (actor.terminalId) {
      params.push(actor.terminalId);
      conditions.push(`register.terminal_id = $${params.length}`);
    }

    const sql = `
        SELECT
          session.id AS cash_session_id,
          session.cash_register_id,
          register.terminal_id
        FROM public.cash_sessions AS session
        INNER JOIN public.cash_registers AS register
          ON register.id = session.cash_register_id
          AND register.tenant_id = session.tenant_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY session.opened_at DESC
        LIMIT 1
      `;
    const result = client
      ? await client.query<{
          cash_session_id: string;
          cash_register_id: string;
          terminal_id: string | null;
        }>(sql, params)
      : await this.db.query<{
          cash_session_id: string;
          cash_register_id: string;
          terminal_id: string | null;
        }>(sql, params);

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      cashSessionId: row.cash_session_id,
      cashRegisterId: row.cash_register_id,
      terminalId: row.terminal_id,
      cashImpactAmount,
      recordedAt: new Date(),
    };
  }

  private async resolveRequiredCashContext(
    tenantId: string,
    branchId: string,
    actor: DeliveryActor,
    cashImpactAmount: number,
    schema: DeliveryCashSchema,
    client?: PoolClient
  ) {
    if (!schema.has_cash_columns || !schema.has_cash_tables) {
      throw new BadRequestException(
        "Migracion de caja para domicilios pendiente: ejecute V067__deliveries_current_cash_session.sql"
      );
    }

    const cashContext = await this.queryCurrentCashContext(
      tenantId,
      branchId,
      actor,
      cashImpactAmount,
      client
    );

    if (!cashContext) {
      throw new BadRequestException(
        "Abre una caja antes de registrar domicilios con valor o metodo de pago"
      );
    }

    return cashContext;
  }

  private appendCashAssignments(
    params: unknown[],
    assignments: string[],
    cashContext: DeliveryCashContext
  ) {
    params.push(cashContext.cashSessionId);
    assignments.push(`cash_session_id = $${params.length}`);
    params.push(cashContext.cashRegisterId);
    assignments.push(`cash_register_id = $${params.length}`);
    params.push(cashContext.terminalId);
    assignments.push(`terminal_id = $${params.length}`);
    params.push(cashContext.cashImpactAmount);
    assignments.push(`cash_impact_amount = $${params.length}`);
    params.push(cashContext.recordedAt);
    assignments.push(`cash_impact_recorded_at = $${params.length}`);
  }

  private async enforceCashScopeForTransition(
    client: PoolClient,
    delivery: DeliveryRecord,
    actor: DeliveryActor,
    params: unknown[],
    assignments: string[]
  ) {
    if (!this.hasDeliveryCashImpact(delivery.delivery_fee, delivery.payment_method_id)) {
      return;
    }

    const schema = await this.hasCashScopeSchema();
    const cashContext = await this.resolveRequiredCashContext(
      delivery.tenant_id,
      delivery.branch_id,
      actor,
      Number(delivery.delivery_fee ?? 0),
      schema,
      client
    );

    const existingCashSessionId = delivery.cash_session_id ?? null;
    if (existingCashSessionId && existingCashSessionId !== cashContext.cashSessionId) {
      throw new ForbiddenException(
        "El domicilio pertenece a otra sesion de caja"
      );
    }

    if (!existingCashSessionId) {
      this.appendCashAssignments(params, assignments, cashContext);
    }
  }

  private assertDeliveryBranchScope(delivery: DeliveryRecord, actor: DeliveryActor) {
    const actorBranchId = actor.branchId?.trim();
    if (actorBranchId && actorBranchId !== delivery.branch_id) {
      throw new ForbiddenException("No autorizado para esta sucursal");
    }
  }

  private assertCustomerIdentity(payload: CreateDeliveryDto) {
    const hasCustomerId = Boolean(payload.customer_id);
    const hasCustomerName = Boolean(this.normalizeNullableText(payload.customer_name));
    const hasCustomerPhone = Boolean(this.normalizeNullableText(payload.customer_phone));

    if (!hasCustomerId && !hasCustomerName && !hasCustomerPhone) {
      throw new BadRequestException(
        "Debe informar customer_id o datos minimos del cliente"
      );
    }
  }

  private async insertHistory(
    client: PoolClient,
    deliveryId: string,
    previousStatus: string | null,
    newStatus: string,
    changedByUserId: string | null,
    reason: string | null,
    metadata: Record<string, unknown>
  ) {
    await client.query(
      `
        INSERT INTO public.delivery_status_history (
          delivery_id,
          previous_status,
          new_status,
          changed_by_user_id,
          reason,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        deliveryId,
        previousStatus,
        newStatus,
        changedByUserId,
        reason,
        JSON.stringify(metadata),
      ]
    );
  }

  private buildHistoryMetadata(
    action: DeliveryAction,
    metadata: Record<string, unknown> | undefined,
    notes?: string | null,
    extra?: Record<string, unknown>
  ) {
    const normalizedMetadata = this.normalizeMetadata(metadata);
    return {
      action,
      source: "api",
      ...normalizedMetadata,
      ...(notes ? { notes } : {}),
      ...(extra ?? {}),
    };
  }

  private async findByIdForUpdate(
    client: PoolClient,
    deliveryId: string,
    tenantId: string
  ) {
    const result = await client.query<DeliveryRecord>(
      `
        SELECT *
        FROM public.deliveries
        WHERE id = $1
          AND tenant_id = $2
        FOR UPDATE
      `,
      [deliveryId, tenantId]
    );

    const delivery = result.rows[0];
    if (!delivery) {
      throw new NotFoundException("Domicilio no encontrado");
    }

    return delivery;
  }

  private async assertActiveDriverForAssignment(
    client: PoolClient,
    tenantId: string,
    driverId: string
  ) {
    const result = await client.query<{ id: string; active: boolean }>(
      `
        SELECT id, active
        FROM public.delivery_drivers
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1
      `,
      [driverId, tenantId]
    );

    const driver = result.rows[0];
    if (!driver) {
      throw new BadRequestException("Repartidor invalido para el tenant");
    }
    if (!driver.active) {
      throw new BadRequestException("Repartidor inactivo no disponible");
    }
  }

  async list(filters: QueryDeliveriesDto, actor: DeliveryActor) {
    const tenantId = this.resolveTenantId(actor);
    const branchId = this.resolveBranchId(actor, filters.branch_id);
    if (branchId) {
      await this.assertBranchScope(tenantId, branchId);
    }
    const hasDriverCatalog = await this.hasDriverCatalogSchema();
    const cashSchema = await this.hasCashScopeSchema();
    const hasCashScope = cashSchema.has_cash_columns && cashSchema.has_cash_tables;
    const deliverySelect = this.getDeliverySelect(hasDriverCatalog, hasCashScope);

    const page = Math.max(Number(filters.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(filters.limit ?? 25), 1), 100);
    const offset = (page - 1) * limit;

    if (filters.driver_id && !hasDriverCatalog) {
      return {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          total_pages: 0,
        },
      };
    }

    const params: unknown[] = [tenantId];
    const conditions = ["d.tenant_id = $1"];

    if (branchId) {
      params.push(branchId);
      conditions.push(`d.branch_id = $${params.length}`);
    }

    if (filters.status) {
      const statusValues = getDeliveryStatusFilterValues(filters.status);
      if (statusValues.length === 0) {
        throw new BadRequestException("Estado de domicilio invalido");
      }
      params.push(statusValues);
      conditions.push(`d.status = ANY($${params.length}::text[])`);
    }

    if (filters.customer_id) {
      params.push(filters.customer_id);
      conditions.push(`d.customer_id = $${params.length}`);
    }

    if (filters.order_id) {
      params.push(filters.order_id);
      conditions.push(`d.order_id = $${params.length}`);
    }

    if (filters.sale_id) {
      params.push(filters.sale_id);
      conditions.push(`d.sale_id = $${params.length}`);
    }

    if (filters.driver_id) {
      params.push(filters.driver_id);
      conditions.push(`d.driver_id = $${params.length}`);
    }

    if (filters.cash_session_id) {
      if (!hasCashScope) {
        return {
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            total_pages: 0,
          },
        };
      }
      if (!this.isAdminCashScope(actor)) {
        const currentBranchId = branchId ?? actor.branchId;
        if (!currentBranchId) {
          throw new ForbiddenException("No autorizado para otra sesion de caja");
        }
        const currentCash = await this.queryCurrentCashContext(
          tenantId,
          currentBranchId,
          actor,
          0
        );
        if (!currentCash || currentCash.cashSessionId !== filters.cash_session_id) {
          throw new ForbiddenException("No autorizado para otra sesion de caja");
        }
      }
      params.push(filters.cash_session_id);
      conditions.push(`d.cash_session_id = $${params.length}`);
    } else if (filters.cash_scope === "current") {
      if (!hasCashScope) {
        return {
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            total_pages: 0,
          },
        };
      }
      const currentCash = branchId
        ? await this.queryCurrentCashContext(tenantId, branchId, actor, 0)
        : null;
      if (!currentCash) {
        return {
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            total_pages: 0,
          },
        };
      }
      params.push(currentCash.cashSessionId);
      conditions.push(`d.cash_session_id = $${params.length}`);
    }

    if (filters.date_from) {
      params.push(filters.date_from);
      conditions.push(`d.created_at >= $${params.length}::timestamptz`);
    }

    if (filters.date_to) {
      params.push(filters.date_to);
      conditions.push(`d.created_at <= $${params.length}::timestamptz`);
    }

    params.push(limit);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const result = await this.db.query<DeliveryRecord>(
      `
        SELECT
${deliverySelect.fields},
          COUNT(*) OVER() AS total_count
        FROM public.deliveries d
${deliverySelect.join}
        WHERE ${conditions.join(" AND ")}
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      params
    );

    const total = Number(result.rows[0]?.total_count ?? 0);
    return {
      data: result.rows.map((record) => this.mapRecord(record)),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async create(payload: CreateDeliveryDto, actor: DeliveryActor) {
    const tenantId = this.resolveTenantId(actor);
    const branchId = this.resolveBranchId(actor, payload.branch_id);
    if (!branchId) {
      throw new BadRequestException("branch_id es requerido");
    }

    let saleForDelivery: SaleDeliverySourceRecord | null = null;

    if (payload.order_id) {
      const order = await this.loadOrderForDelivery(payload.order_id, tenantId);
      const orderBranchId = this.normalizeNullableText(order.branch_id);
      if (orderBranchId && orderBranchId !== branchId) {
        throw new BadRequestException("branch_id no coincide con el pedido");
      }
    }

    if (payload.sale_id) {
      saleForDelivery = await this.loadSaleForDelivery(payload.sale_id, tenantId);
      if (saleForDelivery.branch_id !== branchId) {
        throw new BadRequestException("branch_id no coincide con la factura");
      }
      if (
        payload.order_id &&
        saleForDelivery.order_id &&
        payload.order_id !== saleForDelivery.order_id
      ) {
        throw new BadRequestException("order_id no coincide con la factura");
      }
    }
    const effectiveOrderId =
      payload.order_id ?? saleForDelivery?.order_id ?? undefined;

    const deliveryAddress = this.normalizeRequiredText(
      payload.delivery_address,
      "delivery_address es requerido"
    );
    const deliveryFee = this.normalizeAmount(payload.delivery_fee);
    const subtotal = this.normalizeAmount(payload.subtotal);
    const total = this.normalizeAmount(payload.total);
    const metadata = this.normalizeMetadata(payload.metadata);
    const driverId = payload.driver_id ?? null;
    const cashSchema = await this.hasCashScopeSchema();
    const hasCashImpact = this.hasDeliveryCashImpact(
      deliveryFee,
      payload.payment_method_id
    );

    if (driverId && !(await this.hasDriverCatalogSchema())) {
      throw new BadRequestException(
        "Migracion de repartidores pendiente: ejecute V066__delivery_drivers.sql"
      );
    }

    this.assertCustomerIdentity(payload);
    await this.assertBranchScope(tenantId, branchId);
    await this.assertCustomerScope(tenantId, payload.customer_id);
    await this.assertOrderScope(tenantId, effectiveOrderId);
    await this.assertSaleScope(tenantId, branchId, payload.sale_id);
    await this.assertPaymentMethodScope(tenantId, payload.payment_method_id);

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      if (payload.sale_id) {
        const sale =
          saleForDelivery ?? (await this.loadSaleForDelivery(payload.sale_id, tenantId));
        await this.lockSaleForDelivery(client, tenantId, sale.id);
        await this.assertNoSaleDelivery(
          client,
          tenantId,
          sale.id,
          sale.order_id ?? effectiveOrderId
        );
      }
      if (effectiveOrderId) {
        await this.lockOrderForDelivery(client, tenantId, effectiveOrderId);
        await this.assertNoOrderDelivery(client, tenantId, effectiveOrderId);
      }
      if (driverId) {
        await this.assertActiveDriverForAssignment(client, tenantId, driverId);
      }
      const cashContext = hasCashImpact
        ? await this.resolveRequiredCashContext(
            tenantId,
            branchId,
            actor,
            deliveryFee,
            cashSchema,
            client
          )
        : null;

      const deliveryNumber = await this.deliveryNumberService.generate(
        tenantId,
        branchId,
        client
      );
      const columns: string[] = [
        "tenant_id",
        "branch_id",
        "customer_id",
        "order_id",
        "sale_id",
        "delivery_number",
        "status",
        "customer_name",
        "customer_phone",
        "delivery_address",
        "delivery_reference",
        "delivery_fee",
        "subtotal",
        "total",
        "payment_method_id",
      ];
      const insertParams: unknown[] = [
        tenantId,
        branchId,
        payload.customer_id ?? null,
        effectiveOrderId ?? null,
        payload.sale_id ?? null,
        deliveryNumber,
        "CREATED",
        this.normalizeNullableText(payload.customer_name),
        this.normalizeNullableText(payload.customer_phone),
        deliveryAddress,
        this.normalizeNullableText(payload.delivery_reference),
        deliveryFee,
        subtotal,
        total,
        payload.payment_method_id ?? null,
      ];
      const values = insertParams.map((_, index) => `$${index + 1}`);
      const addInsertColumn = (
        column: string,
        value: unknown,
        cast?: string
      ) => {
        insertParams.push(value);
        columns.push(column);
        values.push(`$${insertParams.length}${cast ?? ""}`);
      };

      if (driverId) {
        addInsertColumn("driver_id", driverId, "::uuid");
      }
      if (cashContext) {
        addInsertColumn("cash_session_id", cashContext.cashSessionId);
        addInsertColumn("cash_register_id", cashContext.cashRegisterId);
        addInsertColumn("terminal_id", cashContext.terminalId);
        addInsertColumn("cash_impact_amount", cashContext.cashImpactAmount);
        addInsertColumn("cash_impact_recorded_at", cashContext.recordedAt);
      }

      addInsertColumn("notes", this.normalizeNullableText(payload.notes));
      addInsertColumn("metadata", JSON.stringify(metadata), "::jsonb");
      addInsertColumn("created_by_user_id", actor.userId ?? null);
      addInsertColumn("updated_by_user_id", actor.userId ?? null);

      const insertSql = `
          INSERT INTO public.deliveries (
            ${columns.join(",\n            ")}
          )
          VALUES (
            ${values.join(",\n            ")}
          )
          RETURNING *
        `;
      const result = await client.query<DeliveryRecord>(insertSql, insertParams);

      const created = result.rows[0];
      await this.insertHistory(
        client,
        created.id,
        null,
        "CREATED",
        actor.userId ?? null,
        null,
        {
          action: "CREATE",
          source: "api",
        }
      );
      await client.query("COMMIT");

      return this.mapRecord(created);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createFromOrder(
    orderId: string,
    payload: CreateOrderDeliveryDto,
    actor: DeliveryActor
  ) {
    const tenantId = this.resolveTenantId(actor);
    const order = await this.loadOrderForDelivery(orderId, tenantId);
    const branchId = this.resolveOrderDeliveryBranch(
      order,
      actor,
      payload.branch_id
    );
    const deliveryAddress =
      this.normalizeNullableText(payload.delivery_address) ??
      this.normalizeNullableText(order.customer_address);

    if (!deliveryAddress) {
      throw new BadRequestException("delivery_address es requerido");
    }

    const metadata = this.normalizeMetadata(payload.metadata);
    return this.create(
      {
        branch_id: branchId,
        customer_id: order.customer_id ?? undefined,
        order_id: order.id,
        customer_name:
          this.normalizeNullableText(payload.customer_name) ??
          this.normalizeNullableText(order.customer_name) ??
          undefined,
        customer_phone:
          this.normalizeNullableText(payload.customer_phone) ??
          this.normalizeNullableText(order.customer_phone) ??
          undefined,
        delivery_address: deliveryAddress,
        delivery_reference: payload.delivery_reference,
        delivery_fee: payload.delivery_fee,
        subtotal:
          payload.subtotal ??
          (order.order_total !== null ? Number(order.order_total) : undefined),
        total:
          payload.total ??
          (order.order_total !== null ? Number(order.order_total) : undefined),
        payment_method_id: payload.payment_method_id,
        driver_id: payload.driver_id,
        notes: payload.notes,
        metadata: {
          ...metadata,
          source: "order",
          source_order_id: order.id,
        },
      },
      actor
    );
  }

  async createFromSale(
    saleId: string,
    payload: CreateSaleDeliveryDto,
    actor: DeliveryActor
  ) {
    const tenantId = this.resolveTenantId(actor);
    const sale = await this.loadSaleForDelivery(saleId, tenantId);
    const branchId = this.resolveSaleDeliveryBranch(sale, actor);
    const deliveryAddress =
      this.normalizeNullableText(payload.delivery_address) ??
      this.normalizeNullableText(sale.customer_address);

    if (!deliveryAddress) {
      throw new BadRequestException("delivery_address es requerido");
    }

    const feeAmount = this.normalizeAmount(payload.delivery_fee);
    const deliveryFeeSource =
      payload.delivery_fee_source ?? (feeAmount > 0 ? null : "NO_FEE");
    if (feeAmount > 0 && deliveryFeeSource !== "INVOICE_INCLUDED") {
      throw new BadRequestException(
        "delivery_fee_source debe ser INVOICE_INCLUDED cuando delivery_fee > 0"
      );
    }
    if (feeAmount === 0 && deliveryFeeSource && deliveryFeeSource !== "NO_FEE") {
      throw new BadRequestException("delivery_fee_source no es valido");
    }

    const metadata = this.normalizeMetadata(payload.metadata);
    return this.create(
      {
        branch_id: branchId,
        customer_id: sale.customer_id ?? undefined,
        order_id: sale.order_id ?? undefined,
        sale_id: sale.id,
        customer_name:
          this.normalizeNullableText(payload.customer_name) ??
          this.normalizeNullableText(sale.customer_name) ??
          undefined,
        customer_phone:
          this.normalizeNullableText(payload.customer_phone) ??
          this.normalizeNullableText(sale.customer_phone) ??
          undefined,
        delivery_address: deliveryAddress,
        delivery_reference: payload.delivery_reference,
        delivery_fee: feeAmount,
        subtotal:
          payload.subtotal ??
          (sale.total !== null ? Number(sale.total) : undefined),
        total:
          payload.total ??
          (sale.total !== null ? Number(sale.total) : undefined),
        payment_method_id: payload.payment_method_id,
        driver_id: payload.driver_id,
        notes: payload.notes,
        metadata: {
          ...metadata,
          source: "sale",
          source_sale_id: sale.id,
          delivery_fee_source: deliveryFeeSource ?? "NO_FEE",
          ...(sale.order_id ? { source_order_id: sale.order_id } : {}),
        },
      },
      actor
    );
  }

  async getById(id: string, actor: DeliveryActor) {
    const tenantId = this.resolveTenantId(actor);
    const cashSchema = await this.hasCashScopeSchema();
    const deliverySelect = this.getDeliverySelect(
      await this.hasDriverCatalogSchema(),
      cashSchema.has_cash_columns && cashSchema.has_cash_tables
    );
    const result = await this.db.query<DeliveryRecord>(
      `
        SELECT
${deliverySelect.fields}
        FROM public.deliveries d
${deliverySelect.join}
        WHERE d.id = $1
          AND d.tenant_id = $2
        LIMIT 1
      `,
      [id, tenantId]
    );

    const delivery = result.rows[0];
    if (!delivery) {
      throw new NotFoundException("Domicilio no encontrado");
    }

    return this.mapRecord(delivery);
  }

  async getByOrder(orderId: string, actor: DeliveryActor) {
    const tenantId = this.resolveTenantId(actor);
    const cashSchema = await this.hasCashScopeSchema();
    const deliverySelect = this.getDeliverySelect(
      await this.hasDriverCatalogSchema(),
      cashSchema.has_cash_columns && cashSchema.has_cash_tables
    );
    const order = await this.loadOrderForDelivery(orderId, tenantId);
    const orderBranchId = this.normalizeNullableText(order.branch_id);
    const actorBranchId = this.normalizeNullableText(actor.branchId);

    if (orderBranchId && actorBranchId && orderBranchId !== actorBranchId) {
      throw new ForbiddenException("No autorizado para la sucursal del pedido");
    }

    const result = await this.db.query<DeliveryRecord>(
      `
        SELECT
${deliverySelect.fields}
        FROM public.deliveries d
${deliverySelect.join}
        WHERE d.tenant_id = $1
          AND d.order_id = $2
        ORDER BY d.created_at DESC
        LIMIT 1
      `,
      [tenantId, orderId]
    );

    const delivery = result.rows[0];
    if (!delivery) {
      return null;
    }

    this.assertDeliveryBranchScope(delivery, actor);
    return this.mapRecord(delivery);
  }

  async getBySale(saleId: string, actor: DeliveryActor) {
    const tenantId = this.resolveTenantId(actor);
    const cashSchema = await this.hasCashScopeSchema();
    const deliverySelect = this.getDeliverySelect(
      await this.hasDriverCatalogSchema(),
      cashSchema.has_cash_columns && cashSchema.has_cash_tables
    );
    const sale = await this.loadSaleForDelivery(saleId, tenantId);
    const saleBranchId = this.normalizeNullableText(sale.branch_id);
    const actorBranchId = this.normalizeNullableText(actor.branchId);

    if (saleBranchId && actorBranchId && saleBranchId !== actorBranchId) {
      throw new ForbiddenException("No autorizado para la sucursal de la factura");
    }

    const result = await this.db.query<DeliveryRecord>(
      `
        SELECT
${deliverySelect.fields}
        FROM public.deliveries d
${deliverySelect.join}
        WHERE d.tenant_id = $1
          AND (d.sale_id = $2 OR d.order_id = $3)
        ORDER BY d.created_at DESC
        LIMIT 1
      `,
      [tenantId, saleId, sale.order_id]
    );

    const delivery = result.rows[0];
    if (!delivery) {
      return null;
    }

    this.assertDeliveryBranchScope(delivery, actor);
    return this.mapRecord(delivery);
  }

  private async transitionDelivery(
    id: string,
    actor: DeliveryActor,
    options: TransitionOptions
  ) {
    const tenantId = this.resolveTenantId(actor);
    const notes = this.normalizeNullableText(options.notes);
    const reason = this.normalizeNullableText(options.reason);
    const metadata = this.normalizeMetadata(options.metadata);
    const client = await this.db.getClient();

    try {
      await client.query("BEGIN");
      const current = await this.findByIdForUpdate(client, id, tenantId);
      this.assertDeliveryBranchScope(current, actor);
      const retryAllowed =
        normalizeDeliveryStatus(current.status) !== "NO_ENTREGADO" ||
        current.metadata?.retry_allowed !== false;
      this.stateMachine.assertCanTransition(
        current.status,
        options.nextStatus,
        options.action,
        { retryAllowed }
      );
      options.beforeUpdate?.(current);

      const storedNextStatus = toStoredDeliveryStatus(options.nextStatus);
      const params: unknown[] = [storedNextStatus, actor.userId ?? null];
      const assignments = [
        "status = $1",
        "updated_by_user_id = $2",
        "updated_at = now()",
      ];

      if (notes !== null) {
        params.push(notes);
        assignments.push(`notes = $${params.length}`);
      }

      if (options.metadata !== undefined) {
        params.push(JSON.stringify(metadata));
        assignments.push(`metadata = metadata || $${params.length}::jsonb`);
      }

      await this.enforceCashScopeForTransition(
        client,
        current,
        actor,
        params,
        assignments
      );

      options.buildAssignments?.(params, assignments, current);

      params.push(id);
      const idParam = params.length;
      params.push(tenantId);
      const tenantParam = params.length;

      const result = await client.query<DeliveryRecord>(
        `
          UPDATE public.deliveries
          SET ${assignments.join(", ")}
          WHERE id = $${idParam}
            AND tenant_id = $${tenantParam}
          RETURNING *
        `,
        params
      );

      const updated = result.rows[0];
      if (!updated) {
        throw new NotFoundException("Domicilio no encontrado");
      }

      await this.insertHistory(
        client,
        current.id,
        current.status,
        storedNextStatus,
        actor.userId ?? null,
        reason,
        this.buildHistoryMetadata(
          options.action,
          options.metadata,
          notes,
          options.extraHistoryMetadata
        )
      );

      await client.query("COMMIT");
      return this.mapRecord(updated);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async assign(id: string, payload: AssignDeliveryDto, actor: DeliveryActor) {
    const tenantId = this.resolveTenantId(actor);
    if (payload.assigned_courier_id) {
      await this.assertUserScope(tenantId, payload.assigned_courier_id);
    }

    return this.transitionDelivery(id, actor, {
      action: "PREPARE",
      nextStatus: "EN_PREPARACION",
      notes: payload.notes,
      metadata: payload.metadata,
      extraHistoryMetadata: payload.assigned_courier_id
        ? {
            assigned_courier_id: payload.assigned_courier_id,
          }
        : undefined,
      buildAssignments: (params, assignments) => {
        if (!payload.assigned_courier_id) {
          return;
        }
        params.push(payload.assigned_courier_id);
        assignments.push(`assigned_courier_id = $${params.length}`);
      },
    });
  }

  async prepare(id: string, payload: AssignDeliveryDto, actor: DeliveryActor) {
    return this.assign(id, payload, actor);
  }

  async assignDriver(
    id: string,
    payload: AssignDeliveryDriverDto,
    actor: DeliveryActor
  ) {
    const tenantId = this.resolveTenantId(actor);
    const hasDriverCatalog = await this.hasDriverCatalogSchema();
    const cashSchema = await this.hasCashScopeSchema();
    if (!hasDriverCatalog) {
      throw new BadRequestException(
        "Migracion de repartidores pendiente: ejecute V066__delivery_drivers.sql"
      );
    }
    if (!Object.prototype.hasOwnProperty.call(payload, "driver_id")) {
      throw new BadRequestException("driver_id es requerido");
    }

    const driverId = payload.driver_id ?? null;
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const current = await this.findByIdForUpdate(client, id, tenantId);
      this.assertDeliveryBranchScope(current, actor);
      if (driverId) {
        await this.assertActiveDriverForAssignment(client, tenantId, driverId);
      }
      const deliverySelect = this.getDeliverySelect(
        true,
        cashSchema.has_cash_columns && cashSchema.has_cash_tables
      );

      const result = await client.query<DeliveryRecord>(
        `
          WITH updated AS (
            UPDATE public.deliveries
            SET driver_id = $1::uuid,
                updated_by_user_id = $2,
                updated_at = now()
            WHERE id = $3
              AND tenant_id = $4
            RETURNING *
          )
          SELECT
${deliverySelect.fields}
          FROM updated d
          LEFT JOIN public.delivery_drivers driver
            ON driver.id = d.driver_id
            AND driver.tenant_id = d.tenant_id
        `,
        [driverId, actor.userId ?? null, id, tenantId]
      );

      await client.query("COMMIT");
      return this.mapRecord(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async dispatch(id: string, payload: DispatchDeliveryDto, actor: DeliveryActor) {
    return this.transitionDelivery(id, actor, {
      action: "DISPATCH",
      nextStatus: "DESPACHADO",
      notes: payload.notes,
      metadata: payload.metadata,
      buildAssignments: (params, assignments) => {
        const dispatchedAt = new Date();
        params.push(dispatchedAt);
        assignments.push(`dispatched_at = $${params.length}`);
      },
    });
  }

  async markDelivered(
    id: string,
    payload: MarkDeliveredDeliveryDto,
    actor: DeliveryActor
  ) {
    const deliveredAt = payload.delivered_at
      ? new Date(payload.delivered_at)
      : new Date();
    if (Number.isNaN(deliveredAt.getTime())) {
      throw new BadRequestException("delivered_at invalido");
    }

    return this.transitionDelivery(id, actor, {
      action: "MARK_DELIVERED",
      nextStatus: "ENTREGADO",
      notes: payload.notes,
      metadata: payload.metadata,
      extraHistoryMetadata: {
        ...(payload.received_by ? { received_by: payload.received_by } : {}),
        delivered_at: deliveredAt.toISOString(),
      },
      buildAssignments: (params, assignments) => {
        params.push(deliveredAt);
        assignments.push(`delivered_at = $${params.length}`);
      },
    });
  }

  async markNotDelivered(
    id: string,
    payload: MarkNotDeliveredDeliveryDto,
    actor: DeliveryActor
  ) {
    const reason = this.normalizeRequiredText(
      payload.reason,
      "reason es requerido"
    );

    return this.transitionDelivery(id, actor, {
      action: "MARK_NOT_DELIVERED",
      nextStatus: "NO_ENTREGADO",
      reason,
      notes: payload.notes,
      metadata: payload.metadata,
      buildAssignments: (params, assignments) => {
        const failedAt = new Date();
        params.push(failedAt);
        assignments.push(`failed_at = $${params.length}`);
      },
    });
  }

  async cancel(id: string, payload: CancelDeliveryDto, actor: DeliveryActor) {
    const reason = this.normalizeRequiredText(
      payload.reason,
      "reason es requerido"
    );

    return this.transitionDelivery(id, actor, {
      action: "CANCEL",
      nextStatus: "CANCELADO",
      reason,
      notes: payload.notes,
      metadata: payload.metadata,
      buildAssignments: (params, assignments) => {
        const cancelledAt = new Date();
        params.push(cancelledAt);
        assignments.push(`cancelled_at = $${params.length}`);
      },
    });
  }

  async update(id: string, payload: UpdateDeliveryDto, actor: DeliveryActor) {
    const tenantId = this.resolveTenantId(actor);
    if (payload.payment_method_id !== undefined) {
      await this.assertPaymentMethodScope(tenantId, payload.payment_method_id);
    }

    const params: unknown[] = [];
    const assignments: string[] = [];
    const nextDeliveryFee =
      payload.delivery_fee !== undefined
        ? this.normalizeAmount(payload.delivery_fee)
        : undefined;

    const addAssignment = (column: string, value: unknown) => {
      params.push(value);
      assignments.push(`${column} = $${params.length}`);
    };

    if (payload.customer_name !== undefined) {
      addAssignment("customer_name", this.normalizeNullableText(payload.customer_name));
    }

    if (payload.customer_phone !== undefined) {
      addAssignment("customer_phone", this.normalizeNullableText(payload.customer_phone));
    }

    if (payload.delivery_address !== undefined) {
      addAssignment(
        "delivery_address",
        this.normalizeRequiredText(
          payload.delivery_address,
          "delivery_address no puede estar vacio"
        )
      );
    }

    if (payload.delivery_reference !== undefined) {
      addAssignment(
        "delivery_reference",
        this.normalizeNullableText(payload.delivery_reference)
      );
    }

    if (payload.delivery_fee !== undefined) {
      addAssignment("delivery_fee", nextDeliveryFee);
    }

    if (payload.subtotal !== undefined) {
      addAssignment("subtotal", this.normalizeAmount(payload.subtotal));
    }

    if (payload.total !== undefined) {
      addAssignment("total", this.normalizeAmount(payload.total));
    }

    if (payload.payment_method_id !== undefined) {
      addAssignment("payment_method_id", payload.payment_method_id ?? null);
    }

    if (payload.notes !== undefined) {
      addAssignment("notes", this.normalizeNullableText(payload.notes));
    }

    if (payload.metadata !== undefined) {
      params.push(JSON.stringify(this.normalizeMetadata(payload.metadata)));
      assignments.push(`metadata = $${params.length}::jsonb`);
    }

    if (assignments.length === 0) {
      throw new BadRequestException("No hay campos editables para actualizar");
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const current = await this.findByIdForUpdate(client, id, tenantId);
      this.assertDeliveryBranchScope(current, actor);

      const effectiveDeliveryFee =
        nextDeliveryFee ?? Number(current.delivery_fee ?? 0);
      const effectivePaymentMethodId =
        payload.payment_method_id !== undefined
          ? payload.payment_method_id ?? null
          : current.payment_method_id;

      if (this.hasDeliveryCashImpact(effectiveDeliveryFee, effectivePaymentMethodId)) {
        const schema = await this.hasCashScopeSchema();
        const cashContext = await this.resolveRequiredCashContext(
          current.tenant_id,
          current.branch_id,
          actor,
          effectiveDeliveryFee,
          schema,
          client
        );

        if (
          current.cash_session_id &&
          current.cash_session_id !== cashContext.cashSessionId
        ) {
          throw new ForbiddenException(
            "El domicilio pertenece a otra sesion de caja"
          );
        }

        this.appendCashAssignments(params, assignments, cashContext);
      }

      addAssignment("updated_by_user_id", actor.userId ?? null);
      assignments.push("updated_at = now()");

      params.push(id);
      const idParam = params.length;
      params.push(tenantId);
      const tenantParam = params.length;

      const result = await client.query<DeliveryRecord>(
        `
          UPDATE public.deliveries
          SET ${assignments.join(", ")}
          WHERE id = $${idParam}
            AND tenant_id = $${tenantParam}
          RETURNING *
        `,
        params
      );

      const updated = result.rows[0];
      if (!updated) {
        throw new NotFoundException("Domicilio no encontrado");
      }

      await client.query("COMMIT");
      return this.mapRecord(updated);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
