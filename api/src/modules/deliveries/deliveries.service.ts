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

type DeliveryActor = {
  tenantId?: string;
  userId?: string;
  roles: string[];
  branchId?: string;
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
    const conditions = ["tenant_id = $1", "sale_id = $2"];

    if (orderId) {
      params.push(orderId);
      conditions.push(`order_id = $${params.length}`);
    }

    const result = await client.query<{ id: string; status: string }>(
      `
        SELECT id, status
        FROM public.deliveries
        WHERE ${conditions.join(" AND ")}
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

  async list(filters: QueryDeliveriesDto, actor: DeliveryActor) {
    const tenantId = this.resolveTenantId(actor);
    const branchId = this.resolveBranchId(actor, filters.branch_id);
    if (branchId) {
      await this.assertBranchScope(tenantId, branchId);
    }

    const page = Math.max(Number(filters.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(filters.limit ?? 25), 1), 100);
    const offset = (page - 1) * limit;

    const params: unknown[] = [tenantId];
    const conditions = ["tenant_id = $1"];

    if (branchId) {
      params.push(branchId);
      conditions.push(`branch_id = $${params.length}`);
    }

    if (filters.status) {
      const statusValues = getDeliveryStatusFilterValues(filters.status);
      if (statusValues.length === 0) {
        throw new BadRequestException("Estado de domicilio invalido");
      }
      params.push(statusValues);
      conditions.push(`status = ANY($${params.length}::text[])`);
    }

    if (filters.customer_id) {
      params.push(filters.customer_id);
      conditions.push(`customer_id = $${params.length}`);
    }

    if (filters.order_id) {
      params.push(filters.order_id);
      conditions.push(`order_id = $${params.length}`);
    }

    if (filters.sale_id) {
      params.push(filters.sale_id);
      conditions.push(`sale_id = $${params.length}`);
    }

    if (filters.date_from) {
      params.push(filters.date_from);
      conditions.push(`created_at >= $${params.length}::timestamptz`);
    }

    if (filters.date_to) {
      params.push(filters.date_to);
      conditions.push(`created_at <= $${params.length}::timestamptz`);
    }

    params.push(limit);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const result = await this.db.query<DeliveryRecord>(
      `
        SELECT
          id,
          tenant_id,
          branch_id,
          customer_id,
          order_id,
          sale_id,
          delivery_number,
          status,
          customer_name,
          customer_phone,
          delivery_address,
          delivery_reference,
          delivery_fee,
          subtotal,
          total,
          payment_method_id,
          assigned_courier_id,
          notes,
          metadata,
          created_by_user_id,
          updated_by_user_id,
          created_at,
          updated_at,
          dispatched_at,
          cancelled_at,
          delivered_at,
          failed_at,
          COUNT(*) OVER() AS total_count
        FROM public.deliveries
        WHERE ${conditions.join(" AND ")}
        ORDER BY created_at DESC, id DESC
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

    if (payload.order_id) {
      const order = await this.loadOrderForDelivery(payload.order_id, tenantId);
      const orderBranchId = this.normalizeNullableText(order.branch_id);
      if (orderBranchId && orderBranchId !== branchId) {
        throw new BadRequestException("branch_id no coincide con el pedido");
      }
    }

    if (payload.sale_id) {
      const sale = await this.loadSaleForDelivery(payload.sale_id, tenantId);
      if (sale.branch_id !== branchId) {
        throw new BadRequestException("branch_id no coincide con la factura");
      }
      if (payload.order_id && sale.order_id && payload.order_id !== sale.order_id) {
        throw new BadRequestException("order_id no coincide con la factura");
      }
    }

    const deliveryAddress = this.normalizeRequiredText(
      payload.delivery_address,
      "delivery_address es requerido"
    );
    const deliveryFee = this.normalizeAmount(payload.delivery_fee);
    const subtotal = this.normalizeAmount(payload.subtotal);
    const total = this.normalizeAmount(payload.total);
    const metadata = this.normalizeMetadata(payload.metadata);

    this.assertCustomerIdentity(payload);
    await this.assertBranchScope(tenantId, branchId);
    await this.assertCustomerScope(tenantId, payload.customer_id);
    await this.assertOrderScope(tenantId, payload.order_id);
    await this.assertSaleScope(tenantId, branchId, payload.sale_id);
    await this.assertPaymentMethodScope(tenantId, payload.payment_method_id);

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      if (payload.sale_id) {
        const sale = await this.loadSaleForDelivery(payload.sale_id, tenantId);
        await this.lockSaleForDelivery(client, tenantId, sale.id);
        await this.assertNoSaleDelivery(
          client,
          tenantId,
          sale.id,
          sale.order_id
        );
      }
      if (payload.order_id) {
        await this.lockOrderForDelivery(client, tenantId, payload.order_id);
        await this.assertNoOrderDelivery(client, tenantId, payload.order_id);
      }

      const deliveryNumber = await this.deliveryNumberService.generate(
        tenantId,
        branchId,
        client
      );
      const result = await client.query<DeliveryRecord>(
        `
          INSERT INTO public.deliveries (
            tenant_id,
            branch_id,
            customer_id,
            order_id,
            sale_id,
            delivery_number,
            status,
            customer_name,
            customer_phone,
            delivery_address,
            delivery_reference,
            delivery_fee,
            subtotal,
            total,
            payment_method_id,
            notes,
            metadata,
            created_by_user_id,
            updated_by_user_id
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            'CREATED',
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16::jsonb,
            $17,
            $17
          )
          RETURNING *
        `,
        [
          tenantId,
          branchId,
          payload.customer_id ?? null,
          payload.order_id ?? null,
          payload.sale_id ?? null,
          deliveryNumber,
          this.normalizeNullableText(payload.customer_name),
          this.normalizeNullableText(payload.customer_phone),
          deliveryAddress,
          this.normalizeNullableText(payload.delivery_reference),
          deliveryFee,
          subtotal,
          total,
          payload.payment_method_id ?? null,
          this.normalizeNullableText(payload.notes),
          JSON.stringify(metadata),
          actor.userId ?? null,
        ]
      );

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
    const result = await this.db.query<DeliveryRecord>(
      `
        SELECT *
        FROM public.deliveries
        WHERE id = $1
          AND tenant_id = $2
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
    const order = await this.loadOrderForDelivery(orderId, tenantId);
    const orderBranchId = this.normalizeNullableText(order.branch_id);
    const actorBranchId = this.normalizeNullableText(actor.branchId);

    if (orderBranchId && actorBranchId && orderBranchId !== actorBranchId) {
      throw new ForbiddenException("No autorizado para la sucursal del pedido");
    }

    const result = await this.db.query<DeliveryRecord>(
      `
        SELECT *
        FROM public.deliveries
        WHERE tenant_id = $1
          AND order_id = $2
        ORDER BY created_at DESC
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
    const sale = await this.loadSaleForDelivery(saleId, tenantId);
    const saleBranchId = this.normalizeNullableText(sale.branch_id);
    const actorBranchId = this.normalizeNullableText(actor.branchId);

    if (saleBranchId && actorBranchId && saleBranchId !== actorBranchId) {
      throw new ForbiddenException("No autorizado para la sucursal de la factura");
    }

    const result = await this.db.query<DeliveryRecord>(
      `
        SELECT *
        FROM public.deliveries
        WHERE tenant_id = $1
          AND (sale_id = $2 OR order_id = $3)
        ORDER BY created_at DESC
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
      addAssignment("delivery_fee", this.normalizeAmount(payload.delivery_fee));
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

    addAssignment("updated_by_user_id", actor.userId ?? null);
    assignments.push("updated_at = now()");

    params.push(id);
    const idParam = params.length;
    params.push(tenantId);
    const tenantParam = params.length;

    const result = await this.db.query<DeliveryRecord>(
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

    return this.mapRecord(updated);
  }
}
