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
import { CreateDeliveryDto } from "./dto/create-delivery.dto";
import { QueryDeliveriesDto } from "./dto/query-deliveries.dto";
import { UpdateDeliveryDto } from "./dto/update-delivery.dto";
import { DeliveryNumberService } from "./services/delivery-number.service";

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
  cancelled_at: Date | string | null;
  delivered_at: Date | string | null;
  total_count?: string | number;
};

@Injectable()
export class DeliveriesService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(DeliveryNumberService)
    private readonly deliveryNumberService: DeliveryNumberService
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
      status: record.status,
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
      cancelled_at: record.cancelled_at,
      delivered_at: record.delivered_at,
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
        null,
        JSON.stringify(metadata),
      ]
    );
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
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }

    if (filters.customer_id) {
      params.push(filters.customer_id);
      conditions.push(`customer_id = $${params.length}`);
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
          cancelled_at,
          delivered_at,
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
      await this.insertHistory(client, created.id, null, "CREATED", actor.userId ?? null, {
        source: "api",
      });
      await client.query("COMMIT");

      return this.mapRecord(created);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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
