import {
  BadRequestException,
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
  PurchaseEntity,
  type PurchaseStatus,
  type PurchaseType,
} from "../entities/purchase.entity";
import {
  StockMovementService,
  type InventoryContext,
} from "./stock-movement.service";
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
  productId: string;
  quantity: number;
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
  quantity?: string | number | null;
  ordered_quantity?: string | number | null;
  received_quantity?: string | number | null;
  cost: string | number;
  subtotal: string | number;
};

type ProductRow = {
  id: string;
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

@Injectable()
export class PurchaseService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(StockMovementService)
    private readonly stockMovementService: StockMovementService,
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
      items: itemRows.map((row) => ({
        ...this.mapPurchaseItem(row),
        productName: row.product_name ?? null,
      })),
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
          s.name AS supplier_name
        FROM purchases p
        LEFT JOIN suppliers s
          ON s.id = p.supplier_id
         AND s.tenant_id = p.tenant_id
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
          pi.ordered_quantity,
          pi.received_quantity,
          pi.cost,
          pi.subtotal
        FROM purchase_items pi
        INNER JOIN products p
          ON p.id = pi.product_id
         AND p.tenant_id = $2
        WHERE pi.purchase_id = $1
        ORDER BY p.name ASC, pi.id ASC
      `,
      [id, tenantId]
    );

    return {
      ...this.mapPurchaseWithItems(purchaseRow, itemsResult.rows),
      supplierName: purchaseRow.supplier_name,
      branchId: purchaseAuditContext.branch_id,
      branchName: purchaseAuditContext.branch_name,
      terminalName: purchaseAuditContext.terminal_name,
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
      for (const item of items) {
        const currentItems = itemsByProductId.get(item.productId) ?? [];
        currentItems.push(item);
        itemsByProductId.set(item.productId, currentItems);
      }

      const pendingByItemId = new Map(
        items.map((item) => [item.id, item.orderedQuantity - item.receivedQuantity])
      );
      const createdMovements: StockMovementEntity[] = [];

      for (const receiveItem of itemsToReceive) {
        const productId = receiveItem.productId;
        if (!productId) {
          throw new BadRequestException("productId is required");
        }

        const quantity = Number(receiveItem.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new BadRequestException("received quantity must be a positive number");
        }

        const productItems = itemsByProductId.get(productId) ?? [];
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
            branchId: purchaseAuditContext.branch_id ?? context?.branchId ?? null,
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

          await client.query(
            `
              UPDATE purchase_items
              SET received_quantity = received_quantity + $2
              WHERE id = $1
            `,
            [item.id, receivedDelta]
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

  async cancelPurchase(id: string, tenantId: string) {
    const result = await this.db.query<PurchaseRow>(
      `
        UPDATE purchases
        SET status = 'CANCELLED'
        WHERE id = $1
          AND tenant_id = $2
          AND status <> 'RECEIVED'
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
      [id, tenantId]
    );

    if (!result.rows[0]) {
      const existing = await this.db.query<PurchaseRow>(
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
        `,
        [id, tenantId]
      );

      if (!existing.rows[0]) {
        throw new NotFoundException("purchase not found");
      }
      if (existing.rows[0].status === "RECEIVED") {
        throw new BadRequestException("received purchases cannot be cancelled");
      }
    }

    return this.mapPurchase(result.rows[0]);
  }
}
