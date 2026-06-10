import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import { AuditService } from "../../../common/services/audit.service";
import { FinanceAccessRepository } from "../../finance/common/repositories/finance-access.repository";
import { PurchaseItemEntity } from "../entities/purchase-item.entity";
import type { StockMovementEntity } from "../entities/stock-movement.entity";
import {
  PURCHASE_STATUSES,
  PurchaseEntity,
  type PurchaseStatus,
  type PurchaseType,
} from "../entities/purchase.entity";
import {
  StockMovementService,
  type InventoryContext,
} from "./stock-movement.service";
import { InventoryLotBalanceService } from "./inventory-lot-balance.service";
import { InventoryLotService } from "./inventory-lot.service";
import { StockMovementLotService } from "./stock-movement-lot.service";
import {
  canViewAllBranches,
  hasBranchScopedRole,
  normalizeOptionalFilter,
  type BranchScopedActor,
  type BranchScopedFilters,
} from "../utils/access";

type CreatePurchaseItemInput = {
  id?: string;
  productId: string;
  quantity?: number;
  orderedQuantity?: number;
  receivedQuantity?: number;
  cost: number;
  subtotal: number;
};

type CreatePurchaseInput = {
  tenantId: string;
  supplierId: string;
  branchId?: string;
  type?: PurchaseType;
  total: number;
  balance?: number;
  items: CreatePurchaseItemInput[];
  context?: InventoryContext;
  actor: BranchScopedActor;
};

type UpdatePurchaseInput = Partial<{
  supplierId: string;
  type: PurchaseType;
  total: number;
  balance: number;
  status: Extract<PurchaseStatus, "DRAFT" | "PENDING">;
  items: CreatePurchaseItemInput[];
}>;

type ReceivePurchaseItemInput = {
  productId?: string;
  purchaseItemId?: string;
  quantity?: number;
  receivedQuantity?: number;
  lotCode?: string | null;
  expirationDate?: string | null;
  locationId?: string | null;
  unitCost?: number;
};

type CancelPurchaseInput = {
  motivoCancelacion?: string;
  context?: InventoryContext;
  actor: BranchScopedActor;
};

type SettlePartialPurchaseInput = {
  motivoLiquidacion?: string;
  context?: InventoryContext;
  actor: BranchScopedActor;
};

type PurchaseRow = {
  id: string;
  tenant_id: string;
  supplier_id: string;
  type: PurchaseType;
  status: PurchaseStatus;
  total: string | number;
  balance: string | number;
  payment_status: "PENDING" | "PARTIAL" | "PAID" | "OVERPAID";
  total_paid: string | number;
  balance_due: string | number;
  created_at: string | Date;
  motivo_cancelacion?: string | null;
  cancelado_por?: string | null;
  cancelado_por_nombre?: string | null;
  cancelado_en?: string | Date | null;
  total_pedido?: string | number | null;
  total_recibido?: string | number | null;
  total_liquidado?: string | number | null;
  total_no_recibido?: string | number | null;
  motivo_liquidacion?: string | null;
  liquidado_por?: string | null;
  liquidado_por_nombre?: string | null;
  liquidado_en?: string | Date | null;
};

type PurchaseListRow = PurchaseRow & {
  tenant_name: string;
  supplier_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  terminal_name: string | null;
};

type PurchaseDetailRow = PurchaseRow & {
  supplier_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  terminal_name: string | null;
};

type PurchaseItemRow = {
  id: string;
  purchase_id: string;
  product_id: string;
  product_name?: string | null;
  product_sku?: string | null;
  is_perishable?: boolean | null;
  requires_lot?: boolean | null;
  requires_expiration?: boolean | null;
  quantity?: string | number | null;
  ordered_quantity?: string | number | null;
  received_quantity?: string | number | null;
  cost: string | number;
  subtotal: string | number;
  pending_quantity?: string | number | null;
  received_subtotal?: string | number | null;
  unreceived_subtotal?: string | number | null;
};

type ProductRow = {
  id: string;
};

type ProductLotPolicyRow = {
  id: string;
  requires_lot: boolean;
  requires_expiration: boolean;
};

type BranchRow = {
  id: string;
};

type PurchaseAuditContextRow = {
  branch_id: string | null;
  branch_name: string | null;
  terminal_id: string | null;
  terminal_name: string | null;
};

type PurchaseStatusHistoryRow = {
  action: string;
  estado_anterior: PurchaseStatus | null;
  estado_nuevo: PurchaseStatus | null;
  motivo: string | null;
  usuario_id: string | null;
  usuario_nombre: string | null;
  created_at: string | Date;
};

const PURCHASE_STATUS = {
  DRAFT: PURCHASE_STATUSES[0],
  PENDING: PURCHASE_STATUSES[1],
  PARTIAL: PURCHASE_STATUSES[2],
  RECEIVED: PURCHASE_STATUSES[3],
  CERRADA_PARCIAL: PURCHASE_STATUSES[4],
  CANCELLED: PURCHASE_STATUSES[5],
} as const;

const CANCELLABLE_PURCHASE_STATUSES = [
  PURCHASE_STATUS.DRAFT,
  PURCHASE_STATUS.PENDING,
] as const satisfies readonly PurchaseStatus[];

@Injectable()
export class PurchaseService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(StockMovementService)
    private readonly stockMovementService: StockMovementService,
    @Inject(InventoryLotService)
    private readonly inventoryLotService: InventoryLotService,
    @Inject(InventoryLotBalanceService)
    private readonly inventoryLotBalanceService: InventoryLotBalanceService,
    @Inject(StockMovementLotService)
    private readonly stockMovementLotService: StockMovementLotService,
    @Inject(FinanceAccessRepository)
    private readonly financeAccessRepository: FinanceAccessRepository,
    @Inject(AuditService) private readonly auditService: AuditService
  ) {}

  private mapPurchase(row: PurchaseRow) {
    return PurchaseEntity.create({
      id: row.id,
      tenantId: row.tenant_id,
      supplierId: row.supplier_id,
      type: row.type,
      status: row.status,
      total: Number(row.total),
      balance: Number(row.balance ?? 0),
      paymentStatus: row.payment_status,
      totalPaid: Number(row.total_paid ?? 0),
      balanceDue: Number(row.balance_due ?? row.balance ?? 0),
      createdAt: new Date(row.created_at),
    });
  }

  private mapPurchaseCancellation(row: PurchaseRow) {
    return {
      motivoCancelacion: row.motivo_cancelacion ?? null,
      canceladoPor: row.cancelado_por ?? null,
      canceladoPorNombre: row.cancelado_por_nombre ?? null,
      canceladoEn: row.cancelado_en ? new Date(row.cancelado_en).toISOString() : null,
      totalPedido: row.total_pedido == null ? null : Number(row.total_pedido),
      totalRecibido: row.total_recibido == null ? null : Number(row.total_recibido),
      totalLiquidado: row.total_liquidado == null ? null : Number(row.total_liquidado),
      totalNoRecibido: row.total_no_recibido == null ? null : Number(row.total_no_recibido),
      motivoLiquidacion: row.motivo_liquidacion ?? null,
      liquidadoPor: row.liquidado_por ?? null,
      liquidadoPorNombre: row.liquidado_por_nombre ?? null,
      liquidadoEn: row.liquidado_en ? new Date(row.liquidado_en).toISOString() : null,
    };
  }

  private mapStatusHistory(row: PurchaseStatusHistoryRow) {
    return {
      action: row.action,
      estadoAnterior: row.estado_anterior,
      estadoNuevo: row.estado_nuevo,
      motivo: row.motivo,
      usuarioId: row.usuario_id,
      usuarioNombre: row.usuario_nombre,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  private async resolveAllowedBranchIds(
    actor: BranchScopedActor,
    tenantId: string
  ) {
    if (canViewAllBranches(actor)) {
      return undefined;
    }
    if (!actor.userId) {
      throw new ForbiddenException("Usuario requerido");
    }

    const branchIds = await this.financeAccessRepository.findAccessibleBranchIds(
      actor.userId,
      tenantId
    );

    if (branchIds.length > 0) {
      return branchIds;
    }
    if (actor.branchId) {
      return [actor.branchId];
    }

    throw new ForbiddenException("Usuario sin sucursales asignadas");
  }

  private async resolvePurchaseScope(
    actor: BranchScopedActor,
    filters: BranchScopedFilters
  ) {
    const tenantId = normalizeOptionalFilter(filters.tenantId);
    const branchId = normalizeOptionalFilter(filters.branchId);

    if (actor.roles.includes("SUPER_ADMIN")) {
      return { tenantId, branchId, branchIds: undefined as string[] | undefined };
    }

    if (!actor.tenantId) {
      throw new ForbiddenException("Tenant requerido");
    }
    if (tenantId && tenantId !== actor.tenantId) {
      throw new ForbiddenException("No autorizado para otro tenant");
    }

    const resolvedTenantId = actor.tenantId;
    const allowedBranchIds = await this.resolveAllowedBranchIds(actor, resolvedTenantId);

    if (branchId && (allowedBranchIds?.length ?? 0) > 0 && !allowedBranchIds?.includes(branchId)) {
      throw new ForbiddenException("No autorizado para otra sucursal");
    }

    if (hasBranchScopedRole(actor) && actor.branchId) {
      if (branchId && branchId !== actor.branchId) {
        throw new ForbiddenException("No autorizado para otra sucursal");
      }

      return {
        tenantId: resolvedTenantId,
        branchId: actor.branchId,
        branchIds: [actor.branchId],
      };
    }

    return {
      tenantId: resolvedTenantId,
      branchId,
      branchIds: allowedBranchIds,
    };
  }

  private mapPurchaseItem(row: PurchaseItemRow) {
    const orderedQuantity = Number(
      row.ordered_quantity ?? row.quantity ?? 0
    );
    const receivedQuantity = Number(row.received_quantity ?? 0);

    return PurchaseItemEntity.create({
      id: row.id,
      purchaseId: row.purchase_id,
      productId: row.product_id,
      orderedQuantity,
      receivedQuantity,
      cost: Number(row.cost),
      subtotal: Number(row.subtotal),
    });
  }

  private mapPurchaseWithItems(
    purchaseRow: PurchaseRow,
    itemRows: PurchaseItemRow[]
  ) {
    return {
      ...this.mapPurchase(purchaseRow),
      ...this.mapPurchaseCancellation(purchaseRow),
      items: itemRows.map((row) => {
        const item = this.mapPurchaseItem(row);
        const pendingQuantity = Math.max(item.orderedQuantity - item.receivedQuantity, 0);
        return {
          ...item,
          productName: row.product_name ?? null,
          productSku: row.product_sku ?? null,
          isPerishable: row.is_perishable ?? false,
          requiresLot: row.requires_lot ?? false,
          requiresExpiration: row.requires_expiration ?? false,
          pendingQuantity:
            row.pending_quantity == null ? pendingQuantity : Number(row.pending_quantity),
          receivedSubtotal:
            row.received_subtotal == null
              ? Number((item.receivedQuantity * item.cost).toFixed(2))
              : Number(row.received_subtotal),
          unreceivedSubtotal:
            row.unreceived_subtotal == null
              ? Number((pendingQuantity * item.cost).toFixed(2))
              : Number(row.unreceived_subtotal),
        };
      }),
    };
  }

  private assertItems(items: CreatePurchaseItemInput[] | undefined) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException("purchase items are required");
    }
  }

  private normalizeItems(items: CreatePurchaseItemInput[], purchaseId: string) {
    return items.map((item) =>
      PurchaseItemEntity.create({
        id: item.id ?? crypto.randomUUID(),
        purchaseId,
        productId: item.productId,
        orderedQuantity: item.orderedQuantity ?? item.quantity ?? 0,
        receivedQuantity: item.receivedQuantity ?? 0,
        cost: item.cost,
        subtotal: item.subtotal,
      })
    );
  }

  private resolveBalance(total: number) {
    if (!Number.isFinite(total) || total < 0) {
      throw new BadRequestException("total must be a non-negative number");
    }
    return total;
  }

  private resolveStatusFromItems(
    items: Array<Pick<PurchaseItemEntity, "orderedQuantity" | "receivedQuantity">>
  ): PurchaseStatus {
    if (items.length === 0) {
      return "PENDING";
    }

    const allZero = items.every((item) => item.receivedQuantity === 0);
    if (allZero) {
      return "PENDING";
    }

    const allComplete = items.every(
      (item) => item.receivedQuantity === item.orderedQuantity
    );
    if (allComplete) {
      return "RECEIVED";
    }

    return "PARTIAL";
  }

  private async ensureProductsBelongToTenant(
    items: CreatePurchaseItemInput[],
    tenantId: string,
    client: PoolClient
  ) {
    for (const item of items) {
      const product = await client.query<ProductRow>(
        `
        SELECT id
        FROM products
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
        `,
        [item.productId, tenantId]
      );

      if (!product.rows[0]) {
        throw new BadRequestException("product not found for tenant");
      }
    }
  }

  private async ensureBranchBelongsToTenant(
    branchId: string,
    tenantId: string,
    client: PoolClient
  ) {
    const result = await client.query<BranchRow>(
      `
        SELECT id
        FROM tenant_branches
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
      `,
      [branchId, tenantId]
    );

    if (!result.rows[0]) {
      throw new BadRequestException("branch not found for tenant");
    }
  }

  private async getPurchaseAuditContext(
    purchaseId: string,
    tenantId: string,
    client?: PoolClient
  ) {
    const sql = `
        SELECT
          audit_context.branch_id::text AS branch_id,
          branch.nombre AS branch_name,
          audit_context.terminal_id::text AS terminal_id,
          terminal.name AS terminal_name
        FROM purchases p
        LEFT JOIN LATERAL (
          SELECT
            NULLIF(ae.datos_despues->>'branchId', '')::uuid AS branch_id,
            NULLIF(ae.datos_despues->>'terminalId', '')::uuid AS terminal_id
          FROM auditoria_eventos ae
          WHERE ae.tenant_id = p.tenant_id
            AND ae.entidad = 'purchases'
            AND ae.entidad_id = p.id::text
            AND ae.accion = 'PURCHASE_CREATED'
          ORDER BY ae.created_at DESC, ae.id DESC
          LIMIT 1
        ) AS audit_context ON TRUE
        LEFT JOIN tenant_branches branch
          ON branch.id = audit_context.branch_id
         AND branch.tenant_id = p.tenant_id
        LEFT JOIN terminals terminal
          ON terminal.id = audit_context.terminal_id
         AND terminal.tenant_id = p.tenant_id
        WHERE p.id = $1
          AND p.tenant_id = $2
        LIMIT 1
      `;
    const params = [purchaseId, tenantId];
    const result = client
      ? await client.query<PurchaseAuditContextRow>(sql, params)
      : await this.db.query<PurchaseAuditContextRow>(sql, params);

    return (
      result.rows[0] ?? {
        branch_id: null,
        branch_name: null,
        terminal_id: null,
        terminal_name: null,
      }
    );
  }

  private async replaceItems(
    purchaseId: string,
    items: PurchaseItemEntity[],
    client: PoolClient
  ) {
    await client.query(`DELETE FROM purchase_items WHERE purchase_id = $1`, [purchaseId]);

    for (const item of items) {
      await client.query(
        `
          INSERT INTO purchase_items (
            id,
            purchase_id,
            product_id,
            ordered_quantity,
            received_quantity,
            cost,
            subtotal
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7
          )
        `,
        [
          item.id,
          item.purchaseId,
          item.productId,
          item.orderedQuantity,
          item.receivedQuantity,
          item.cost,
          item.subtotal,
        ]
      );
    }
  }

  async createPurchase(data: CreatePurchaseInput) {
    this.assertItems(data.items);
    const resolvedScope = await this.resolvePurchaseScope(data.actor, {
      tenantId: data.tenantId,
      branchId: data.branchId,
    });
    const purchaseBranchId = resolvedScope.branchId ?? data.context?.branchId ?? undefined;
    if (!purchaseBranchId) {
      throw new BadRequestException("branch is required");
    }

    const purchaseId = crypto.randomUUID();
    const purchaseType = data.type ?? "CASH";
    const purchaseBalance = this.resolveBalance(data.total);
    const purchase = PurchaseEntity.create({
      id: purchaseId,
      tenantId: data.tenantId,
      supplierId: data.supplierId,
      type: purchaseType,
      status: "DRAFT",
      total: data.total,
      balance: purchaseBalance,
      totalPaid: 0,
      balanceDue: purchaseBalance,
      paymentStatus: "PENDING",
      createdAt: new Date(),
    });

    const items = this.normalizeItems(data.items, purchase.id);

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      await this.ensureProductsBelongToTenant(data.items, purchase.tenantId, client);
      await this.ensureBranchBelongsToTenant(purchaseBranchId, purchase.tenantId, client);

      const purchaseResult = await client.query<PurchaseRow>(
        `
          INSERT INTO purchases (
            id,
            tenant_id,
            supplier_id,
            type,
            status,
            total,
            balance,
            payment_status,
            total_paid,
            balance_due,
            created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
          )
          RETURNING
            id,
            tenant_id,
            supplier_id,
            type,
            status,
            total,
            balance,
            payment_status,
            total_paid,
            balance_due,
            created_at
        `,
        [
          purchase.id,
          purchase.tenantId,
          purchase.supplierId,
          purchase.type,
          purchase.status,
          purchase.total,
          purchase.balance,
          purchase.paymentStatus,
          purchase.totalPaid,
          purchase.balanceDue,
          purchase.createdAt,
        ]
      );

      await this.replaceItems(purchase.id, items, client);

      await client.query("COMMIT");

      this.auditService.logEvent({
        tenantId: purchase.tenantId,
        userId: data.context?.userId ?? null,
        module: "inventory",
        entity: "purchases",
        entityId: purchase.id,
        action: "PURCHASE_CREATED",
        after: {
          supplierId: purchase.supplierId,
          type: purchase.type,
          total: purchase.total,
          balance: purchase.balance,
          branchId: purchaseBranchId,
          terminalId:
            data.context?.branchId === purchaseBranchId ? data.context?.terminalId ?? null : null,
          posSessionId:
            data.context?.branchId === purchaseBranchId ? data.context?.posSessionId ?? null : null,
        },
      });

      return {
        ...this.mapPurchase(purchaseResult.rows[0]),
        items,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updatePurchase(
    id: string,
    tenantId: string,
    data: UpdatePurchaseInput,
    actor: BranchScopedActor
  ) {
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      await this.resolvePurchaseScope(actor, { tenantId });

      const currentResult = await client.query<PurchaseRow>(
        `
          SELECT
            id,
            tenant_id,
            supplier_id,
            type,
            status,
            total,
            balance,
            payment_status,
            total_paid,
            balance_due,
            created_at
          FROM purchases
          WHERE id = $1 AND tenant_id = $2
          LIMIT 1
          FOR UPDATE
        `,
        [id, tenantId]
      );

      const current = currentResult.rows[0];
      if (!current) {
        throw new NotFoundException("purchase not found");
      }
      if (current.status === "RECEIVED") {
        throw new BadRequestException("received purchases cannot be updated");
      }
      if (current.status === "CANCELLED") {
        throw new BadRequestException("cancelled purchases cannot be updated");
      }
      if (current.status === PURCHASE_STATUS.CERRADA_PARCIAL) {
        throw new BadRequestException("closed partial purchases cannot be updated");
      }

      const purchaseAuditContext = await this.getPurchaseAuditContext(id, tenantId, client);
      await this.resolvePurchaseScope(actor, {
        tenantId,
        branchId: purchaseAuditContext.branch_id ?? undefined,
      });

      if (data.items) {
        this.assertItems(data.items);
        await this.ensureProductsBelongToTenant(data.items, tenantId, client);
      }

      const nextType = data.type ?? current.type;
      const nextTotal =
        data.total !== undefined ? data.total : Number(current.total);
      const nextTotalPaid = Number(current.total_paid ?? 0);
      const nextBalance = Math.max(nextTotal - nextTotalPaid, 0);
      const nextPaymentStatus =
        nextTotalPaid <= 0
          ? "PENDING"
          : nextTotalPaid < nextTotal
            ? "PARTIAL"
            : nextTotalPaid === nextTotal
              ? "PAID"
              : "OVERPAID";
      const nextStatus = data.status ?? current.status;

      const updateResult = await client.query<PurchaseRow>(
        `
          UPDATE purchases
          SET
            supplier_id = COALESCE($3, supplier_id),
            type = COALESCE($4, type),
            status = COALESCE($5, status),
            total = COALESCE($6, total),
            balance = COALESCE($7, balance),
            total_paid = $8,
            balance_due = $9,
            payment_status = $10
          WHERE id = $1 AND tenant_id = $2
          RETURNING
            id,
            tenant_id,
            supplier_id,
            type,
            status,
            total,
            balance,
            payment_status,
            total_paid,
            balance_due,
            created_at
        `,
        [
          id,
          tenantId,
          data.supplierId ?? null,
          nextType,
          nextStatus,
          nextTotal,
          nextBalance,
          nextTotalPaid,
          nextBalance,
          nextPaymentStatus,
        ]
      );

      let items: PurchaseItemEntity[] = [];
      if (data.items) {
        items = this.normalizeItems(data.items, id);
        await this.replaceItems(id, items, client);
      } else {
        const itemsResult = await client.query<PurchaseItemRow>(
          `
            SELECT
              id,
              purchase_id,
              product_id,
              ordered_quantity,
              received_quantity,
              cost,
              subtotal
            FROM purchase_items
            WHERE purchase_id = $1
            ORDER BY id
          `,
          [id]
        );
        items = itemsResult.rows.map((row) => this.mapPurchaseItem(row));
      }

      await client.query("COMMIT");

      return {
        ...this.mapPurchase(updateResult.rows[0]),
        items,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getPurchases(filters: BranchScopedFilters, actor: BranchScopedActor) {
    const resolvedFilters = await this.resolvePurchaseScope(actor, filters);
    const params: unknown[] = [];
    const where: string[] = [];
    const fromDate = normalizeOptionalFilter(filters.fromDate);
    const toDate = normalizeOptionalFilter(filters.toDate);
    const paymentMethod = normalizeOptionalFilter(filters.paymentMethod);

    if (resolvedFilters.tenantId) {
      params.push(resolvedFilters.tenantId);
      where.push(`p.tenant_id = $${params.length}`);
    }

    if (resolvedFilters.branchId) {
      params.push(resolvedFilters.branchId);
      where.push(`audit_context.branch_id = $${params.length}::uuid`);
    } else if ((resolvedFilters.branchIds?.length ?? 0) > 0) {
      params.push(resolvedFilters.branchIds);
      where.push(`audit_context.branch_id = ANY($${params.length}::uuid[])`);
    }

    if (fromDate) {
      params.push(fromDate);
      where.push(`p.created_at >= $${params.length}::date`);
    }

    if (toDate) {
      params.push(toDate);
      where.push(`p.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    if (paymentMethod) {
      params.push(paymentMethod);
      where.push(`
        EXISTS (
          SELECT 1
          FROM payments AS pay
          WHERE pay.tenant_id = p.tenant_id
            AND pay.reference_type = 'PURCHASE'
            AND pay.reference_id = p.id
            AND pay.payment_method_id = $${params.length}::uuid
            AND pay.status IN ('PENDING', 'COMPLETED')
        )
      `);
    }

    const result = await this.db.query<PurchaseListRow>(
      `
        SELECT
          p.id,
          p.tenant_id,
          t.nombre AS tenant_name,
          p.supplier_id,
          p.type,
          p.status,
          p.total,
          p.balance,
          p.payment_status,
          p.total_paid,
          p.balance_due,
          p.created_at,
          p.motivo_cancelacion,
          p.cancelado_por::text AS cancelado_por,
          COALESCE(
            NULLIF(TRIM(CONCAT(cancel_person.nombres, ' ', cancel_person.apellidos)), ''),
            cancel_user.email
          ) AS cancelado_por_nombre,
          p.cancelado_en,
          p.total_pedido,
          p.total_recibido,
          p.total_liquidado,
          p.total_no_recibido,
          p.motivo_liquidacion,
          p.liquidado_por::text AS liquidado_por,
          COALESCE(
            NULLIF(TRIM(CONCAT(liquid_person.nombres, ' ', liquid_person.apellidos)), ''),
            liquid_user.email
          ) AS liquidado_por_nombre,
          p.liquidado_en,
          s.name AS supplier_name,
          audit_context.branch_id::text AS branch_id,
          branch.nombre AS branch_name,
          terminal.name AS terminal_name
        FROM purchases p
        INNER JOIN tenants t
          ON t.id = p.tenant_id
        LEFT JOIN suppliers s
          ON s.id = p.supplier_id
         AND s.tenant_id = p.tenant_id
        LEFT JOIN users cancel_user
          ON cancel_user.id = p.cancelado_por
         AND cancel_user.tenant_id = p.tenant_id
        LEFT JOIN personas cancel_person
          ON cancel_person.id = cancel_user.persona_id
         AND cancel_person.tenant_id = cancel_user.tenant_id
        LEFT JOIN users liquid_user
          ON liquid_user.id = p.liquidado_por
         AND liquid_user.tenant_id = p.tenant_id
        LEFT JOIN personas liquid_person
          ON liquid_person.id = liquid_user.persona_id
         AND liquid_person.tenant_id = liquid_user.tenant_id
        LEFT JOIN LATERAL (
          SELECT
            NULLIF(ae.datos_despues->>'branchId', '')::uuid AS branch_id,
            NULLIF(ae.datos_despues->>'terminalId', '')::uuid AS terminal_id
          FROM auditoria_eventos ae
          WHERE ae.tenant_id = p.tenant_id
            AND ae.entidad = 'purchases'
            AND ae.entidad_id = p.id::text
            AND ae.accion = 'PURCHASE_CREATED'
          ORDER BY ae.created_at DESC, ae.id DESC
          LIMIT 1
        ) AS audit_context ON TRUE
        LEFT JOIN tenant_branches branch
          ON branch.id = audit_context.branch_id
         AND branch.tenant_id = p.tenant_id
        LEFT JOIN terminals terminal
          ON terminal.id = audit_context.terminal_id
         AND terminal.tenant_id = p.tenant_id
        WHERE ${where.length > 0 ? where.join("\n          AND ") : "TRUE"}
        ORDER BY p.created_at DESC
      `,
      params
    );

    return result.rows.map((row) => ({
      ...this.mapPurchase(row),
      ...this.mapPurchaseCancellation(row),
      tenantName: row.tenant_name,
      supplierName: row.supplier_name,
      branchId: row.branch_id,
      branchName: row.branch_name,
      terminalName: row.terminal_name,
    }));
  }

  async getPurchaseById(id: string, tenantId: string, actor: BranchScopedActor) {
    const purchaseAuditContext = await this.getPurchaseAuditContext(id, tenantId);
    await this.resolvePurchaseScope(actor, {
      tenantId,
      branchId: purchaseAuditContext.branch_id ?? undefined,
    });

    const purchaseResult = await this.db.query<PurchaseDetailRow>(
      `
        SELECT
          p.id,
          p.tenant_id,
          p.supplier_id,
          p.type,
          p.status,
          p.total,
          p.balance,
          p.payment_status,
          p.total_paid,
          p.balance_due,
          p.created_at,
          p.motivo_cancelacion,
          p.cancelado_por::text AS cancelado_por,
          COALESCE(
            NULLIF(TRIM(CONCAT(cancel_person.nombres, ' ', cancel_person.apellidos)), ''),
            cancel_user.email
          ) AS cancelado_por_nombre,
          p.cancelado_en,
          p.total_pedido,
          p.total_recibido,
          p.total_liquidado,
          p.total_no_recibido,
          p.motivo_liquidacion,
          p.liquidado_por::text AS liquidado_por,
          COALESCE(
            NULLIF(TRIM(CONCAT(liquid_person.nombres, ' ', liquid_person.apellidos)), ''),
            liquid_user.email
          ) AS liquidado_por_nombre,
          p.liquidado_en,
          s.name AS supplier_name
        FROM purchases p
        LEFT JOIN suppliers s
          ON s.id = p.supplier_id
         AND s.tenant_id = p.tenant_id
        LEFT JOIN users cancel_user
          ON cancel_user.id = p.cancelado_por
         AND cancel_user.tenant_id = p.tenant_id
        LEFT JOIN personas cancel_person
          ON cancel_person.id = cancel_user.persona_id
         AND cancel_person.tenant_id = cancel_user.tenant_id
        LEFT JOIN users liquid_user
          ON liquid_user.id = p.liquidado_por
         AND liquid_user.tenant_id = p.tenant_id
        LEFT JOIN personas liquid_person
          ON liquid_person.id = liquid_user.persona_id
         AND liquid_person.tenant_id = liquid_user.tenant_id
        WHERE p.id = $1 AND p.tenant_id = $2
        LIMIT 1
      `,
      [id, tenantId]
    );

    const purchaseRow = purchaseResult.rows[0];
    if (!purchaseRow) {
      throw new NotFoundException("purchase not found");
    }

    const itemsResult = await this.db.query<PurchaseItemRow>(
      `
        SELECT
          pi.id,
          pi.purchase_id,
          pi.product_id,
          p.name AS product_name,
          p.sku AS product_sku,
          p.is_perishable,
          p.requires_lot,
          p.requires_expiration,
          pi.ordered_quantity,
          pi.received_quantity,
          pi.cost,
          pi.subtotal,
          pi.pending_quantity,
          pi.received_subtotal,
          pi.unreceived_subtotal
        FROM purchase_items pi
        INNER JOIN products p
          ON p.id = pi.product_id
         AND p.tenant_id = $2
        WHERE pi.purchase_id = $1
        ORDER BY p.name ASC, pi.id ASC
      `,
      [id, tenantId]
    );

    const historyResult = await this.db.query<PurchaseStatusHistoryRow>(
      `
        SELECT
          ae.accion AS action,
          ae.datos_antes->>'status' AS estado_anterior,
          ae.datos_despues->>'status' AS estado_nuevo,
          COALESCE(
            ae.datos_despues->>'motivoCancelacion',
            ae.datos_despues->>'motivoLiquidacion'
          ) AS motivo,
          ae.usuario_id::text AS usuario_id,
          COALESCE(
            NULLIF(TRIM(CONCAT(person.nombres, ' ', person.apellidos)), ''),
            u.email
          ) AS usuario_nombre,
          ae.created_at
        FROM auditoria_eventos ae
        LEFT JOIN users u
          ON u.id = ae.usuario_id
         AND u.tenant_id = ae.tenant_id
        LEFT JOIN personas person
          ON person.id = u.persona_id
         AND person.tenant_id = u.tenant_id
        WHERE ae.tenant_id = $2
          AND ae.entidad = 'purchases'
          AND ae.entidad_id = $1
          AND ae.accion IN ('PURCHASE_CANCELLED', 'PURCHASE_PARTIAL_CLOSED')
        ORDER BY ae.created_at ASC, ae.id ASC
      `,
      [id, tenantId]
    );

    return {
      ...this.mapPurchaseWithItems(purchaseRow, itemsResult.rows),
      supplierName: purchaseRow.supplier_name,
      branchId: purchaseAuditContext.branch_id,
      branchName: purchaseAuditContext.branch_name,
      terminalName: purchaseAuditContext.terminal_name,
      statusHistory: historyResult.rows.map((row) => this.mapStatusHistory(row)),
    };
  }

  private normalizeOptionalReceiveId(value: string | null | undefined) {
    if (value === null) {
      return null;
    }
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private hasLotReceiptData(item: ReceivePurchaseItemInput) {
    return (
      this.normalizeOptionalReceiveId(item.lotCode) !== undefined ||
      this.normalizeOptionalReceiveId(item.expirationDate) !== undefined ||
      this.normalizeOptionalReceiveId(item.locationId) !== undefined ||
      item.unitCost !== undefined
    );
  }

  private normalizeLotCodeForReceipt(value: string | null | undefined) {
    const normalized = this.normalizeOptionalReceiveId(value);
    if (!normalized) {
      throw new BadRequestException("lotCode is required for this product");
    }
    return normalized.toUpperCase();
  }

  private async loadProductLotPolicies(
    tenantId: string,
    productIds: string[],
    client: PoolClient
  ) {
    const uniqueProductIds = [...new Set(productIds)];
    if (uniqueProductIds.length === 0) {
      return new Map<string, ProductLotPolicyRow>();
    }

    const result = await client.query<ProductLotPolicyRow>(
      `
        SELECT id, requires_lot, requires_expiration
        FROM products
        WHERE tenant_id = $1
          AND id = ANY($2::uuid[])
      `,
      [tenantId, uniqueProductIds]
    );

    return new Map(result.rows.map((row) => [row.id, row]));
  }

  private resolveReceiveItemProduct(
    receiveItem: ReceivePurchaseItemInput,
    itemsById: Map<string, PurchaseItemEntity>
  ) {
    const purchaseItemId = this.normalizeOptionalReceiveId(
      receiveItem.purchaseItemId
    );
    const purchaseItem = purchaseItemId ? itemsById.get(purchaseItemId) : null;
    if (purchaseItemId && !purchaseItem) {
      throw new BadRequestException("purchase item not found");
    }

    const productId = receiveItem.productId?.trim() || purchaseItem?.productId;
    if (!productId) {
      throw new BadRequestException("productId is required");
    }
    if (purchaseItem && purchaseItem.productId !== productId) {
      throw new BadRequestException("productId does not match purchaseItemId");
    }

    return { productId, purchaseItemId, purchaseItem };
  }

  private validateReceiveLotPayload(
    receiveItem: ReceivePurchaseItemInput,
    policy: ProductLotPolicyRow
  ) {
    if (!policy.requires_lot) {
      if (this.hasLotReceiptData(receiveItem)) {
        throw new BadRequestException(
          "lot data is not allowed for products without lot control"
        );
      }
      return null;
    }

    const lotCode = this.normalizeLotCodeForReceipt(receiveItem.lotCode);
    const expirationDate = this.normalizeOptionalReceiveId(
      receiveItem.expirationDate
    );
    if (policy.requires_expiration && !expirationDate) {
      throw new BadRequestException(
        "expirationDate is required for this product"
      );
    }

    const unitCost =
      receiveItem.unitCost !== undefined ? Number(receiveItem.unitCost) : undefined;
    if (unitCost !== undefined && (!Number.isFinite(unitCost) || unitCost < 0)) {
      throw new BadRequestException("unitCost must be non-negative");
    }

    return {
      lotCode,
      expirationDate,
      locationId: this.normalizeOptionalReceiveId(receiveItem.locationId),
      unitCost,
    };
  }

  async receivePurchase(
    id: string,
    tenantId: string,
    itemsToReceive: ReceivePurchaseItemInput[],
    context?: InventoryContext,
    actor?: BranchScopedActor
  ) {
    if (!Array.isArray(itemsToReceive) || itemsToReceive.length === 0) {
      throw new BadRequestException("receive items are required");
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      const purchaseResult = await client.query<PurchaseRow>(
        `
          SELECT
            id,
            tenant_id,
            supplier_id,
            type,
            status,
            total,
            balance,
            payment_status,
            total_paid,
            balance_due,
            created_at
          FROM purchases
          WHERE id = $1 AND tenant_id = $2
          LIMIT 1
          FOR UPDATE
        `,
        [id, tenantId]
      );

      const purchaseRow = purchaseResult.rows[0];
      if (!purchaseRow) {
        throw new NotFoundException("purchase not found");
      }
      if (purchaseRow.status === "RECEIVED") {
        throw new BadRequestException("purchase already received");
      }
      if (purchaseRow.status === "CANCELLED") {
        throw new BadRequestException("cancelled purchases cannot be received");
      }
      if (purchaseRow.status === PURCHASE_STATUS.CERRADA_PARCIAL) {
        throw new BadRequestException("closed partial purchases cannot be received");
      }

      const purchaseAuditContext = await this.getPurchaseAuditContext(id, tenantId, client);
      await this.resolvePurchaseScope(
        actor ?? {
          roles: [],
          userId: context?.userId ?? undefined,
          tenantId,
          branchId: context?.branchId ?? undefined,
        },
        {
          tenantId,
          branchId: purchaseAuditContext.branch_id ?? undefined,
        }
      );

      const itemsResult = await client.query<PurchaseItemRow>(
        `
            SELECT
              id,
              purchase_id,
              product_id,
              ordered_quantity,
              received_quantity,
              cost,
              subtotal
          FROM purchase_items
          WHERE purchase_id = $1
          ORDER BY id
        `,
        [id]
      );

      const items = itemsResult.rows.map((row) => this.mapPurchaseItem(row));
      if (items.length === 0) {
        throw new BadRequestException("purchase items are required");
      }

      const itemsByProductId = new Map<string, PurchaseItemEntity[]>();
      const itemsById = new Map<string, PurchaseItemEntity>();
      for (const item of items) {
        const currentItems = itemsByProductId.get(item.productId) ?? [];
        currentItems.push(item);
        itemsByProductId.set(item.productId, currentItems);
        itemsById.set(item.id, item);
      }

      const productPolicies = await this.loadProductLotPolicies(
        tenantId,
        items.map((item) => item.productId),
        client
      );
      const pendingByItemId = new Map(
        items.map((item) => [item.id, item.orderedQuantity - item.receivedQuantity])
      );
      const createdMovements: StockMovementEntity[] = [];
      const receiptBranchId = purchaseAuditContext.branch_id ?? context?.branchId ?? null;

      for (const receiveItem of itemsToReceive) {
        const { productId, purchaseItemId, purchaseItem } =
          this.resolveReceiveItemProduct(receiveItem, itemsById);
        const productPolicy = productPolicies.get(productId);
        if (!productPolicy) {
          throw new BadRequestException("product not found for tenant");
        }
        const lotPayload = this.validateReceiveLotPayload(
          receiveItem,
          productPolicy
        );

        const quantity = Number(
          receiveItem.receivedQuantity ?? receiveItem.quantity
        );
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new BadRequestException("received quantity must be a positive number");
        }

        const productItems = purchaseItem
          ? [purchaseItem]
          : itemsByProductId.get(productId) ?? [];
        if (productItems.length === 0) {
          throw new BadRequestException("purchase item not found for product");
        }

        const totalPendingQuantity = productItems.reduce(
          (sum, item) => sum + (pendingByItemId.get(item.id) ?? 0),
          0
        );
        if (quantity > totalPendingQuantity) {
          throw new BadRequestException(
            "received quantity exceeds pending ordered quantity"
          );
        }

        const movement = await this.stockMovementService.createMovement(
          {
            id: crypto.randomUUID(),
            tenantId,
            productId,
            type: "IN",
            quantity,
            referenceType: "PURCHASE",
            referenceId: id,
            branchId: receiptBranchId,
            terminalId:
              purchaseAuditContext.branch_id &&
              context?.branchId &&
              purchaseAuditContext.branch_id !== context.branchId
                ? null
                : context?.terminalId ?? null,
            posSessionCode:
              purchaseAuditContext.branch_id &&
              context?.branchId &&
              purchaseAuditContext.branch_id !== context.branchId
                ? null
                : context?.posSessionId ?? null,
            userId: context?.userId ?? null,
            referenceTable: "purchases",
            createdAt: new Date(),
          },
          client
        );
        createdMovements.push(movement);

        let remainingQuantity = quantity;
        const allocations: Array<{
          item: PurchaseItemEntity;
          quantity: number;
        }> = [];
        for (const item of productItems) {
          if (remainingQuantity <= 0) {
            break;
          }

          const itemPendingQuantity = pendingByItemId.get(item.id) ?? 0;
          if (itemPendingQuantity <= 0) {
            continue;
          }

          const receivedDelta = Math.min(remainingQuantity, itemPendingQuantity);
          pendingByItemId.set(item.id, itemPendingQuantity - receivedDelta);
          remainingQuantity -= receivedDelta;
          allocations.push({ item, quantity: receivedDelta });

          await client.query(
            `
              UPDATE purchase_items
              SET received_quantity = received_quantity + $2
              WHERE id = $1
            `,
            [item.id, receivedDelta]
          );
        }

        if (lotPayload) {
          const branchId = movement.branchId ?? receiptBranchId;
          if (!branchId) {
            throw new BadRequestException(
              "branchId is required for lot receipt"
            );
          }
          const firstAllocation = allocations[0];
          const lot = await this.inventoryLotService.findOrCreateForPurchase(
            {
              tenantId,
              branchId,
              productId,
              supplierId: purchaseRow.supplier_id,
              purchaseId: id,
              purchaseItemId: purchaseItemId ?? firstAllocation?.item.id ?? null,
              lotCode: lotPayload.lotCode,
              expirationDate: lotPayload.expirationDate,
              receivedAt: movement.createdAt,
              unitCost: lotPayload.unitCost ?? firstAllocation?.item.cost ?? 0,
              requiresExpiration: productPolicy.requires_expiration,
            },
            client
          );

          await this.inventoryLotBalanceService.incrementOnHand(
            tenantId,
            {
              branchId,
              productId,
              lotId: lot.id,
              locationId: lotPayload.locationId ?? null,
              quantity,
              lastMovementAt: movement.createdAt,
            },
            client
          );

          await this.stockMovementLotService.createLink(
            {
              tenantId,
              stockMovementId: movement.id,
              productId,
              lotId: lot.id,
              locationId: lotPayload.locationId ?? null,
              quantity,
            },
            client
          );
        }
      }

      const updatedItemsResult = await client.query<PurchaseItemRow>(
        `
          SELECT
            id,
            purchase_id,
            product_id,
            ordered_quantity,
            received_quantity,
            cost,
            subtotal
          FROM purchase_items
          WHERE purchase_id = $1
          ORDER BY id
        `,
        [id]
      );

      const updatedItems = updatedItemsResult.rows.map((row) =>
        this.mapPurchaseItem(row)
      );
      const nextStatus = this.resolveStatusFromItems(updatedItems);

      const updatedPurchaseResult = await client.query<PurchaseRow>(
        `
          UPDATE purchases
          SET status = $3
          WHERE id = $1 AND tenant_id = $2
          RETURNING
            id,
            tenant_id,
            supplier_id,
            type,
            status,
            total,
            balance,
            payment_status,
            total_paid,
            balance_due,
            created_at
        `,
        [id, tenantId, nextStatus]
      );

      await client.query("COMMIT");
      createdMovements.forEach((movement) =>
        this.stockMovementService.logMovementAuditEvent(movement)
      );

      return {
        ...this.mapPurchase(updatedPurchaseResult.rows[0]),
        items: updatedItems,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async settlePartialPurchase(
    id: string,
    tenantId: string,
    userId: string | null,
    data: SettlePartialPurchaseInput
  ) {
    const motivoLiquidacion = data.motivoLiquidacion?.trim();
    if (!motivoLiquidacion) {
      throw new BadRequestException("Motivo de liquidación obligatorio");
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      const purchaseResult = await client.query<PurchaseRow>(
        `
          SELECT
            id,
            tenant_id,
            supplier_id,
            type,
            status,
            total,
            balance,
            payment_status,
            total_paid,
            balance_due,
            created_at
          FROM purchases
          WHERE id = $1 AND tenant_id = $2
          LIMIT 1
          FOR UPDATE
        `,
        [id, tenantId]
      );

      const purchase = purchaseResult.rows[0];
      if (!purchase) {
        throw new NotFoundException("purchase not found");
      }

      const purchaseAuditContext = await this.getPurchaseAuditContext(id, tenantId, client);
      await this.resolvePurchaseScope(data.actor, {
        tenantId,
        branchId: purchaseAuditContext.branch_id ?? undefined,
      });

      if (purchase.status === PURCHASE_STATUS.CERRADA_PARCIAL) {
        throw new ConflictException("La compra ya fue cerrada parcialmente");
      }
      if (purchase.status === PURCHASE_STATUS.CANCELLED) {
        throw new BadRequestException("La compra cancelada no puede liquidarse");
      }
      if (purchase.status === PURCHASE_STATUS.RECEIVED) {
        throw new BadRequestException("La compra ya fue recibida completamente");
      }
      if (purchase.status !== PURCHASE_STATUS.PARTIAL) {
        throw new BadRequestException("Solo se pueden liquidar compras parciales");
      }

      const itemsResult = await client.query<PurchaseItemRow>(
        `
          SELECT
            id,
            purchase_id,
            product_id,
            ordered_quantity,
            received_quantity,
            cost,
            subtotal
          FROM purchase_items
          WHERE purchase_id = $1
          ORDER BY id
        `,
        [id]
      );
      const items = itemsResult.rows.map((row) => this.mapPurchaseItem(row));
      const hasReceived = items.some((item) => item.receivedQuantity > 0);
      const hasPending = items.some((item) => item.receivedQuantity < item.orderedQuantity);
      const hasInvalidReceivedQuantity = items.some(
        (item) => item.receivedQuantity > item.orderedQuantity
      );

      if (!hasReceived || !hasPending) {
        throw new BadRequestException("La compra no tiene diferencias parciales para liquidar");
      }
      if (hasInvalidReceivedQuantity) {
        throw new BadRequestException("La compra tiene cantidades recibidas mayores a las pedidas");
      }

      const roundMoney = (value: number) => Math.round(value * 100) / 100;
      const totalLiquidado = roundMoney(
        items.reduce((sum, item) => sum + item.receivedQuantity * item.cost, 0)
      );
      const totalNoRecibido = roundMoney(
        items.reduce(
          (sum, item) =>
            sum + Math.max(item.orderedQuantity - item.receivedQuantity, 0) * item.cost,
          0
        )
      );
      const paidResult = await client.query<{ total_paid: string | number }>(
        `
          SELECT COALESCE(SUM(allocation.allocated_amount), 0) AS total_paid
          FROM payment_allocations AS allocation
          INNER JOIN payments AS payment
            ON payment.id = allocation.payment_id
          WHERE payment.tenant_id = $2
            AND allocation.reference_type IN ('PURCHASE', 'PURCHASE_ORDER')
            AND allocation.reference_id = $1
            AND payment.status IN ('PENDING', 'COMPLETED')
        `,
        [id, tenantId]
      );
      const totalPagado = Number(paidResult.rows[0]?.total_paid ?? 0);

      if (totalLiquidado <= 0) {
        throw new BadRequestException("La compra no tiene valor recibido para liquidar");
      }
      if (totalPagado > totalLiquidado) {
        throw new ConflictException(
          "No se puede liquidar la compra porque los pagos registrados superan el valor recibido. Debe gestionarse primero la devolución o ajuste correspondiente."
        );
      }

      const saldo = roundMoney(Math.max(totalLiquidado - totalPagado, 0));
      const paymentStatus =
        totalPagado <= 0
          ? "PENDING"
          : totalPagado < totalLiquidado
            ? "PARTIAL"
            : totalPagado === totalLiquidado
              ? "PAID"
              : "OVERPAID";
      const liquidadoEn = new Date();
      const resolvedUserId = userId ?? data.context?.userId ?? data.actor.userId ?? null;

      const updateResult = await client.query<PurchaseRow>(
        `
          UPDATE purchases
          SET
            status = $3,
            total_pedido = COALESCE(total_pedido, total),
            total_recibido = $4,
            total_liquidado = $4,
            total = $4,
            balance = $5,
            balance_due = $5,
            payment_status = $6,
            total_paid = $12,
            total_no_recibido = $7,
            motivo_liquidacion = $8,
            liquidado_por = $9,
            liquidado_en = $10
          WHERE id = $1
            AND tenant_id = $2
            AND status = $11
          RETURNING
            id,
            tenant_id,
            supplier_id,
            type,
            status,
            total,
            balance,
            payment_status,
            total_paid,
            balance_due,
            created_at,
            total_pedido,
            total_recibido,
            total_liquidado,
            total_no_recibido,
            motivo_liquidacion,
            liquidado_por::text AS liquidado_por,
            liquidado_en
        `,
        [
          id,
          tenantId,
          PURCHASE_STATUS.CERRADA_PARCIAL,
          totalLiquidado,
          saldo,
          paymentStatus,
          totalNoRecibido,
          motivoLiquidacion,
          resolvedUserId,
          liquidadoEn,
          PURCHASE_STATUS.PARTIAL,
          totalPagado,
        ]
      );

      if (!updateResult.rows[0]) {
        throw new ConflictException("La compra ya fue cerrada parcialmente o cambió de estado");
      }

      const differences = items.map((item) => ({
        itemId: item.id,
        productId: item.productId,
        orderedQuantity: item.orderedQuantity,
        receivedQuantity: item.receivedQuantity,
        pendingQuantity: Math.max(item.orderedQuantity - item.receivedQuantity, 0),
        cost: item.cost,
        receivedSubtotal: roundMoney(item.receivedQuantity * item.cost),
        pendingSubtotal: roundMoney(
          Math.max(item.orderedQuantity - item.receivedQuantity, 0) * item.cost
        ),
      }));

      for (const difference of differences) {
        await client.query(
          `
            UPDATE purchase_items
            SET
              pending_quantity = $2,
              received_subtotal = $3,
              unreceived_subtotal = $4
            WHERE purchase_id = $1
              AND id = $5
          `,
          [
            id,
            difference.pendingQuantity,
            difference.receivedSubtotal,
            difference.pendingSubtotal,
            difference.itemId,
          ]
        );
      }

      if (this.auditService.isModuleEnabled("inventory")) {
        await client.query(
          `
            INSERT INTO auditoria_eventos
              (tenant_id, usuario_id, modulo, entidad, entidad_id, accion, datos_antes, datos_despues)
            VALUES
              ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
          `,
          [
            tenantId,
            resolvedUserId,
            "inventory",
            "purchases",
            id,
            "PURCHASE_PARTIAL_CLOSED",
            JSON.stringify({
              status: purchase.status,
              total: Number(purchase.total),
              paymentStatus: purchase.payment_status,
              totalPaid: totalPagado,
              balanceDue: Number(purchase.balance_due ?? 0),
            }),
            JSON.stringify({
              status: PURCHASE_STATUS.CERRADA_PARCIAL,
              motivoLiquidacion,
              liquidadoEn: liquidadoEn.toISOString(),
              totalPedido: Number(purchase.total),
              totalLiquidado,
              totalNoRecibido,
              totalPaid: totalPagado,
              balanceDue: saldo,
              paymentStatus,
              branchId: purchaseAuditContext.branch_id,
              differences,
            }),
          ]
        );
      }

      await client.query("COMMIT");

      return {
        statusCode: 200,
        message: "Compra liquidada correctamente con las cantidades recibidas",
        data: {
          ...this.mapPurchase(updateResult.rows[0]),
          ...this.mapPurchaseCancellation(updateResult.rows[0]),
          estado: PURCHASE_STATUS.CERRADA_PARCIAL,
          totalPedido: Number(purchase.total),
          totalRecibido: totalLiquidado,
          totalLiquidado,
          totalPagado,
          saldoPendiente: saldo,
          diferenciaNoRecibida: totalNoRecibido,
          differences,
        },
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async cancelPurchase(id: string, tenantId: string, data: CancelPurchaseInput) {
    const motivoCancelacion = data.motivoCancelacion?.trim();
    if (!motivoCancelacion) {
      throw new BadRequestException("Motivo de cancelación obligatorio");
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      const purchaseResult = await client.query<PurchaseRow>(
        `
          SELECT
            id,
            tenant_id,
            supplier_id,
            type,
            status,
            total,
            balance,
            payment_status,
            total_paid,
            balance_due,
            created_at
          FROM purchases
          WHERE id = $1 AND tenant_id = $2
          LIMIT 1
          FOR UPDATE
        `,
        [id, tenantId]
      );

      const purchase = purchaseResult.rows[0];
      if (!purchase) {
        throw new NotFoundException("purchase not found");
      }

      const purchaseAuditContext = await this.getPurchaseAuditContext(id, tenantId, client);
      await this.resolvePurchaseScope(data.actor, {
        tenantId,
        branchId: purchaseAuditContext.branch_id ?? undefined,
      });

      if (purchase.status === PURCHASE_STATUS.CANCELLED) {
        throw new ConflictException("La compra ya fue cancelada");
      }
      if (purchase.status === PURCHASE_STATUS.RECEIVED) {
        throw new BadRequestException("La compra no puede ser cancelada en su estado actual");
      }
      if (purchase.status === PURCHASE_STATUS.CERRADA_PARCIAL) {
        throw new BadRequestException("La compra ya fue cerrada parcialmente y no puede cancelarse directamente");
      }
      if (purchase.status === PURCHASE_STATUS.PARTIAL) {
        throw new BadRequestException("La compra no puede ser cancelada en su estado actual");
      }
      if (!CANCELLABLE_PURCHASE_STATUSES.includes(purchase.status)) {
        throw new BadRequestException("La compra no puede ser cancelada en su estado actual");
      }
      if (Number(purchase.total_paid ?? 0) > 0 || purchase.payment_status !== "PENDING") {
        throw new ConflictException(
          "La compra tiene pagos que requieren reverso antes de cancelar"
        );
      }

      const itemsResult = await client.query<{ received_quantity: string | number }>(
        `
          SELECT received_quantity
          FROM purchase_items
          WHERE purchase_id = $1
        `,
        [id]
      );
      const hasReceivedItems = itemsResult.rows.some(
        (item) => Number(item.received_quantity ?? 0) > 0
      );
      if (hasReceivedItems) {
        throw new ConflictException(
          "La compra tiene recepción de inventario que requiere reverso"
        );
      }

      const movementResult = await client.query<{ id: string }>(
        `
          SELECT id
          FROM stock_movements
          WHERE tenant_id = $1
            AND reference_type = 'PURCHASE'
            AND reference_id = $2
          LIMIT 1
        `,
        [tenantId, id]
      );
      if (movementResult.rows[0]) {
        throw new ConflictException(
          "La compra tiene movimientos de inventario que requieren reverso"
        );
      }

      const canceladoEn = new Date();
      const result = await client.query<PurchaseRow>(
        `
          UPDATE purchases
          SET
            status = $6,
            motivo_cancelacion = $3,
            cancelado_por = $4,
            cancelado_en = $5
          WHERE id = $1
            AND tenant_id = $2
            AND status = ANY($7::varchar[])
          RETURNING
            id,
            tenant_id,
            supplier_id,
            type,
            status,
            total,
            balance,
            payment_status,
            total_paid,
            balance_due,
            created_at,
            motivo_cancelacion,
            cancelado_por::text AS cancelado_por,
            cancelado_en
        `,
        [
          id,
          tenantId,
          motivoCancelacion,
          data.context?.userId ?? data.actor.userId ?? null,
          canceladoEn,
          PURCHASE_STATUS.CANCELLED,
          [...CANCELLABLE_PURCHASE_STATUSES],
        ]
      );

      if (!result.rows[0]) {
        throw new ConflictException("La compra ya fue cancelada o cambió de estado");
      }

      const userId = data.context?.userId ?? data.actor.userId ?? null;
      const beforeAudit = {
        status: purchase.status,
        paymentStatus: purchase.payment_status,
        totalPaid: Number(purchase.total_paid ?? 0),
        balanceDue: Number(purchase.balance_due ?? 0),
      };
      const afterAudit = {
        status: PURCHASE_STATUS.CANCELLED,
        motivoCancelacion,
        canceladoEn: canceladoEn.toISOString(),
        branchId: purchaseAuditContext.branch_id,
        terminalId:
          purchaseAuditContext.branch_id &&
          data.context?.branchId &&
          purchaseAuditContext.branch_id !== data.context.branchId
            ? null
            : data.context?.terminalId ?? null,
      };

      if (this.auditService.isModuleEnabled("inventory")) {
        await client.query(
          `
            INSERT INTO auditoria_eventos
              (tenant_id, usuario_id, modulo, entidad, entidad_id, accion, datos_antes, datos_despues)
            VALUES
              ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
          `,
          [
            tenantId,
            userId,
            "inventory",
            "purchases",
            id,
            "PURCHASE_CANCELLED",
            JSON.stringify(beforeAudit),
            JSON.stringify(afterAudit),
          ]
        );
      }

      await client.query("COMMIT");

      return {
        statusCode: 200,
        message: "Compra cancelada correctamente",
        data: {
          ...this.mapPurchase(result.rows[0]),
          ...this.mapPurchaseCancellation(result.rows[0]),
          estado: PURCHASE_STATUS.CANCELLED,
        },
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
