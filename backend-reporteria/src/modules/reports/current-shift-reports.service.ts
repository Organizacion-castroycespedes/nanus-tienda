import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { QueryResultRow } from "pg";
import { DatabaseService } from "../database/database.service";
import type { ReportUser } from "../auth/report-auth.types";
import type {
  CurrentShiftActorContext,
  CurrentShiftCashCountRow,
  CurrentShiftCashSession,
  CurrentShiftMovementRow,
  CurrentShiftOrderRow,
  CurrentShiftPurchaseRow,
  CurrentShiftQuery,
  CurrentShiftResponse,
  CurrentShiftSaleRow,
  CurrentShiftSummary,
  CurrentShiftTicketRow,
} from "./types/current-shift-report.types";

const ROLE_PRIORITY = ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SessionRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  branch_id: string;
  branch_name: string | null;
  cash_register_id: string;
  cash_register_name: string | null;
  cash_register_code: string | null;
  terminal_id: string | null;
  terminal_name: string | null;
  opened_by_user_id: string;
  opened_by_user_email: string | null;
  opened_at: string;
  opening_amount: string | number;
  status: string;
};

type SummaryRow = QueryResultRow & {
  summary: Record<string, unknown> | null;
};

type SaleRow = QueryResultRow & {
  id: string;
  created_at: string;
  customer_name: string | null;
  payment_method: string | null;
  status: string;
  total: string | number;
  paid_amount: string | number;
};

type OrderRow = QueryResultRow & {
  id: string;
  created_at: string;
  order_number: string | null;
  customer_name: string | null;
  status: string;
  total: string | number;
  paid_amount: string | number;
};

type PurchaseRow = QueryResultRow & {
  id: string;
  created_at: string;
  supplier_name: string | null;
  status: string;
  total: string | number;
  paid_amount: string | number;
};

type MovementRow = QueryResultRow & {
  id: string;
  created_at: string;
  type: string;
  description: string | null;
  amount: string | number;
  direction: string;
  reference_type: string | null;
  reference_id: string | null;
};

type CashCountRow = QueryResultRow & {
  id: string;
  created_at: string;
  expected_amount: string | number;
  counted_amount: string | number;
  difference: string | number;
  notes: string | null;
};

type PageOptions = {
  page: number;
  pageSize: number;
  offset: number;
  search: string | null;
};

type SessionFilters = {
  branchId?: string;
  terminalId?: string;
  cashRegisterId?: string;
};

@Injectable()
export class CurrentShiftReportsService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  private pickActorRole(roles: string[]): string {
    for (const role of ROLE_PRIORITY) {
      if (roles.some((item) => item.toUpperCase() === role)) {
        return role;
      }
    }

    return roles[0]?.toUpperCase() ?? "USER";
  }

  private resolveActor(user?: ReportUser): CurrentShiftActorContext {
    if (!user?.id || !user.tenantId) {
      throw new BadRequestException("report actor is required");
    }

    return {
      userId: user.id,
      role: this.pickActorRole(user.roles),
      tenantId: user.tenantId,
      branchId: user.branchId ?? null,
      email: user.email ?? null,
    };
  }

  private isSuperAdmin(actor: CurrentShiftActorContext) {
    return actor.role === "SUPER_ADMIN";
  }

  private isSuperUser(actor: CurrentShiftActorContext) {
    return actor.role === "SUPER_USER";
  }

  private normalizeUuid(value: string | undefined, label: string) {
    const normalized = value?.trim();
    if (!normalized) {
      return undefined;
    }
    if (!UUID_PATTERN.test(normalized)) {
      throw new BadRequestException(`${label} is invalid`);
    }
    return normalized;
  }

  private resolveTenant(actor: CurrentShiftActorContext, query: CurrentShiftQuery) {
    const requestedTenant = this.normalizeUuid(query.tenantId, "tenantId");
    if (this.isSuperAdmin(actor)) {
      return requestedTenant ?? actor.tenantId;
    }
    if (requestedTenant && requestedTenant !== actor.tenantId) {
      throw new ForbiddenException("No autorizado para otro tenant");
    }
    return actor.tenantId;
  }

  private normalizePage(query: CurrentShiftQuery): PageOptions {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 50), 1), 100);
    const search = query.search?.trim() ? query.search.trim() : null;
    return {
      page,
      pageSize,
      offset: (page - 1) * pageSize,
      search,
    };
  }

  private toNumber(value: unknown) {
    return Number(value ?? 0);
  }

  private toIso(value: unknown) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value ?? "");
  }

  private emptyTabs(): CurrentShiftResponse["tabs"] {
    return {
      sales: { total: 0, rows: [] },
      orders: { total: 0, rows: [] },
      purchases: { total: 0, rows: [] },
      movements: { total: 0, rows: [] },
      cashCount: { total: 0, rows: [] },
      tickets: { total: 0, rows: [] },
    };
  }

  private mapSession(row: SessionRow): CurrentShiftCashSession {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      branchName: row.branch_name,
      cashRegisterId: row.cash_register_id,
      cashRegisterName: row.cash_register_name,
      cashRegisterCode: row.cash_register_code,
      terminalId: row.terminal_id,
      terminalName: row.terminal_name,
      userId: row.opened_by_user_id,
      userName: row.opened_by_user_email,
      openedAt: this.toIso(row.opened_at),
      openingAmount: this.toNumber(row.opening_amount),
      status: row.status,
    };
  }

  private assertSessionScope(
    actor: CurrentShiftActorContext,
    tenantId: string,
    session: CurrentShiftCashSession,
    query: CurrentShiftQuery
  ) {
    if (session.tenantId !== tenantId) {
      throw new ForbiddenException("No autorizado para otro tenant");
    }

    if (query.branchId && query.branchId !== session.branchId) {
      throw new ForbiddenException("No autorizado para otra sucursal");
    }

    if (query.terminalId && query.terminalId !== session.terminalId) {
      throw new ForbiddenException("No autorizado para otra terminal");
    }

    if (
      query.cashRegisterId &&
      query.cashRegisterId !== session.cashRegisterId
    ) {
      throw new ForbiddenException("No autorizado para otra caja");
    }

    if (actor.role === "USER" && actor.branchId && session.branchId !== actor.branchId) {
      throw new ForbiddenException("No autorizado para otra sucursal");
    }

    if (actor.role === "ADMIN") {
      if (actor.branchId && session.branchId !== actor.branchId) {
        throw new ForbiddenException("No autorizado para otra sucursal");
      }
    }

    if (this.isSuperUser(actor) && session.tenantId !== actor.tenantId) {
      throw new ForbiddenException("No autorizado para otro tenant");
    }
  }

  private async findSessionById(cashSessionId: string) {
    const result = await this.db.query<SessionRow>(
      `/* current-shift: session-by-id */
      SELECT
        session.id::text AS id,
        session.tenant_id::text AS tenant_id,
        session.branch_id::text AS branch_id,
        branch.nombre AS branch_name,
        session.cash_register_id::text AS cash_register_id,
        cash_register.nombre AS cash_register_name,
        cash_register.codigo AS cash_register_code,
        cash_register.terminal_id::text AS terminal_id,
        terminal.name AS terminal_name,
        session.opened_by_user_id::text AS opened_by_user_id,
        opened_user.email AS opened_by_user_email,
        session.opened_at::text AS opened_at,
        session.opening_amount::text AS opening_amount,
        session.status
      FROM cash_sessions AS session
      INNER JOIN cash_registers AS cash_register
        ON cash_register.id = session.cash_register_id
       AND cash_register.tenant_id = session.tenant_id
      LEFT JOIN tenant_branches AS branch
        ON branch.id = session.branch_id
       AND branch.tenant_id = session.tenant_id
      LEFT JOIN terminals AS terminal
        ON terminal.id = cash_register.terminal_id
       AND terminal.tenant_id = session.tenant_id
      LEFT JOIN users AS opened_user
        ON opened_user.id = session.opened_by_user_id
       AND opened_user.tenant_id = session.tenant_id
      WHERE session.id = $1
      LIMIT 1`,
      [cashSessionId]
    );
    return result.rows[0] ? this.mapSession(result.rows[0]) : null;
  }

  private async listAvailableOpenSessions(
    actor: CurrentShiftActorContext,
    tenantId: string,
    filters: SessionFilters
  ) {
    const params: unknown[] = [tenantId];
    const where = [
      "session.tenant_id = $1",
      "session.status = 'OPEN'",
    ];
    const effectiveBranchId =
      filters.branchId ??
      ((actor.role === "USER" || actor.role === "ADMIN") && actor.branchId
        ? actor.branchId
        : undefined);

    if (effectiveBranchId) {
      params.push(effectiveBranchId);
      where.push(`session.branch_id = $${params.length}`);
    }

    if (filters.terminalId) {
      params.push(filters.terminalId);
      where.push(`cash_register.terminal_id = $${params.length}`);
    }

    if (filters.cashRegisterId) {
      params.push(filters.cashRegisterId);
      where.push(`session.cash_register_id = $${params.length}`);
    }

    const requireOwnSession =
      !effectiveBranchId &&
      (actor.role === "USER" ||
        actor.role === "ADMIN" ||
        (!this.isSuperAdmin(actor) && !this.isSuperUser(actor)));

    if (requireOwnSession) {
      params.push(actor.userId);
      where.push(`session.opened_by_user_id = $${params.length}`);
    }

    params.push(actor.userId);
    const actorUserParamIndex = params.length;

    const result = await this.db.query<SessionRow>(
      `/* current-shift: available-sessions */
      SELECT
        session.id::text AS id,
        session.tenant_id::text AS tenant_id,
        session.branch_id::text AS branch_id,
        branch.nombre AS branch_name,
        session.cash_register_id::text AS cash_register_id,
        cash_register.nombre AS cash_register_name,
        cash_register.codigo AS cash_register_code,
        cash_register.terminal_id::text AS terminal_id,
        terminal.name AS terminal_name,
        session.opened_by_user_id::text AS opened_by_user_id,
        opened_user.email AS opened_by_user_email,
        session.opened_at::text AS opened_at,
        session.opening_amount::text AS opening_amount,
        session.status
      FROM cash_sessions AS session
      INNER JOIN cash_registers AS cash_register
        ON cash_register.id = session.cash_register_id
       AND cash_register.tenant_id = session.tenant_id
      LEFT JOIN tenant_branches AS branch
        ON branch.id = session.branch_id
       AND branch.tenant_id = session.tenant_id
      LEFT JOIN terminals AS terminal
        ON terminal.id = cash_register.terminal_id
       AND terminal.tenant_id = session.tenant_id
      LEFT JOIN users AS opened_user
        ON opened_user.id = session.opened_by_user_id
       AND opened_user.tenant_id = session.tenant_id
      WHERE ${where.join(" AND ")}
      ORDER BY
        CASE WHEN session.opened_by_user_id = $${actorUserParamIndex}::uuid THEN 0 ELSE 1 END,
        branch.nombre NULLS LAST,
        terminal.name NULLS LAST,
        cash_register.nombre NULLS LAST,
        session.opened_at DESC
      LIMIT 100`,
      params
    );

    return result.rows.map((row) => this.mapSession(row));
  }

  private async findOpenSession(
    actor: CurrentShiftActorContext,
    tenantId: string,
    branchId?: string
  ) {
    const params: unknown[] = [tenantId];
    const where = [
      "session.tenant_id = $1",
      "session.status = 'OPEN'",
    ];
    const effectiveBranchId =
      branchId ??
      ((actor.role === "USER" || actor.role === "ADMIN") && actor.branchId
        ? actor.branchId
        : undefined);

    if (effectiveBranchId) {
      params.push(effectiveBranchId);
      where.push(`session.branch_id = $${params.length}`);
    }

    params.push(actor.userId);
    const actorUserParamIndex = params.length;
    const requireOwnSession =
      !effectiveBranchId &&
      (actor.role === "USER" ||
        actor.role === "ADMIN" ||
        (!this.isSuperAdmin(actor) && !this.isSuperUser(actor)));

    if (requireOwnSession) {
      where.push(`session.opened_by_user_id = $${actorUserParamIndex}`);
    }

    const result = await this.db.query<SessionRow>(
      `/* current-shift: current-session */
      SELECT
        session.id::text AS id,
        session.tenant_id::text AS tenant_id,
        session.branch_id::text AS branch_id,
        branch.nombre AS branch_name,
        session.cash_register_id::text AS cash_register_id,
        cash_register.nombre AS cash_register_name,
        cash_register.codigo AS cash_register_code,
        cash_register.terminal_id::text AS terminal_id,
        terminal.name AS terminal_name,
        session.opened_by_user_id::text AS opened_by_user_id,
        opened_user.email AS opened_by_user_email,
        session.opened_at::text AS opened_at,
        session.opening_amount::text AS opening_amount,
        session.status
      FROM cash_sessions AS session
      INNER JOIN cash_registers AS cash_register
        ON cash_register.id = session.cash_register_id
       AND cash_register.tenant_id = session.tenant_id
      LEFT JOIN tenant_branches AS branch
        ON branch.id = session.branch_id
       AND branch.tenant_id = session.tenant_id
      LEFT JOIN terminals AS terminal
        ON terminal.id = cash_register.terminal_id
       AND terminal.tenant_id = session.tenant_id
      LEFT JOIN users AS opened_user
        ON opened_user.id = session.opened_by_user_id
       AND opened_user.tenant_id = session.tenant_id
      WHERE ${where.join(" AND ")}
      ORDER BY
        CASE WHEN session.opened_by_user_id = $${actorUserParamIndex}::uuid THEN 0 ELSE 1 END,
        session.opened_at DESC
      LIMIT 1`,
      params
    );
    return result.rows[0] ? this.mapSession(result.rows[0]) : null;
  }

  private async getRawSummary(tenantId: string, cashSessionId: string) {
    const result = await this.db.query<SummaryRow>(
      `/* current-shift: summary */
      SELECT finance_cash_session_summary($1::uuid, $2::uuid) AS summary`,
      [tenantId, cashSessionId]
    );
    return result.rows[0]?.summary ?? null;
  }

  private linkedPaymentsCte() {
    return `WITH linked_payment AS (
      SELECT
        COALESCE(allocation.reference_type, payment.reference_type) AS reference_type,
        COALESCE(allocation.reference_id, payment.reference_id)::text AS reference_id,
        CASE
          WHEN allocation.id IS NULL THEN payment.amount
          ELSE allocation.allocated_amount
        END AS amount,
        payment.created_at,
        method.nombre AS payment_method
      FROM payments AS payment
      LEFT JOIN payment_allocations AS allocation
        ON allocation.payment_id = payment.id
      LEFT JOIN payment_methods AS method
        ON method.id = payment.payment_method_id
       AND method.tenant_id = payment.tenant_id
      WHERE payment.tenant_id = $1
        AND payment.cash_session_id = $2
        AND payment.status IN ('PENDING', 'COMPLETED')
    )`;
  }

  private async listSales(
    tenantId: string,
    cashSessionId: string,
    page: PageOptions
  ): Promise<CurrentShiftSaleRow[]> {
    const result = await this.db.query<SaleRow>(
      `/* current-shift: sales */
      ${this.linkedPaymentsCte()}
      SELECT
        sale.id::text AS id,
        MIN(linked_payment.created_at)::text AS created_at,
        COALESCE(NULLIF(BTRIM(customer.name), ''), 'CONSUMIDOR FINAL') AS customer_name,
        MAX(linked_payment.payment_method) AS payment_method,
        sale.status,
        sale.total::text AS total,
        COALESCE(SUM(linked_payment.amount), 0)::text AS paid_amount
      FROM linked_payment
      INNER JOIN sales AS sale
        ON sale.id::text = linked_payment.reference_id
       AND sale.tenant_id = $1
      LEFT JOIN customers AS customer
        ON customer.id = sale.customer_id
       AND customer.tenant_id = sale.tenant_id
      WHERE linked_payment.reference_type = 'SALE'
        AND (
          $3::text IS NULL
          OR customer.name ILIKE '%' || $3::text || '%'
          OR sale.id::text ILIKE '%' || $3::text || '%'
        )
      GROUP BY sale.id, sale.status, sale.total, customer.name
      ORDER BY MIN(linked_payment.created_at) DESC
      LIMIT $4
      OFFSET $5`,
      [tenantId, cashSessionId, page.search, page.pageSize, page.offset]
    );

    return result.rows.map((row) => ({
      id: row.id,
      createdAt: this.toIso(row.created_at),
      customerName: row.customer_name,
      paymentMethod: row.payment_method,
      status: row.status,
      total: this.toNumber(row.total),
      paidAmount: this.toNumber(row.paid_amount),
      ticketAvailable: true,
    }));
  }

  private async listOrders(
    tenantId: string,
    cashSessionId: string,
    page: PageOptions
  ): Promise<CurrentShiftOrderRow[]> {
    const result = await this.db.query<OrderRow>(
      `/* current-shift: orders */
      ${this.linkedPaymentsCte()}
      SELECT
        ord.id::text AS id,
        MIN(linked_payment.created_at)::text AS created_at,
        ord.id::text AS order_number,
        customer.name AS customer_name,
        ord.status,
        ord.total::text AS total,
        COALESCE(SUM(linked_payment.amount), 0)::text AS paid_amount
      FROM linked_payment
      INNER JOIN orders AS ord
        ON ord.id::text = linked_payment.reference_id
       AND ord.tenant_id = $1
      LEFT JOIN customers AS customer
        ON customer.id = ord.customer_id
       AND customer.tenant_id = ord.tenant_id
      WHERE linked_payment.reference_type = 'SALES_ORDER'
        AND (
          $3::text IS NULL
          OR customer.name ILIKE '%' || $3::text || '%'
          OR ord.id::text ILIKE '%' || $3::text || '%'
        )
      GROUP BY ord.id, ord.status, ord.total, customer.name
      ORDER BY MIN(linked_payment.created_at) DESC
      LIMIT $4
      OFFSET $5`,
      [tenantId, cashSessionId, page.search, page.pageSize, page.offset]
    );

    return result.rows.map((row) => ({
      id: row.id,
      createdAt: this.toIso(row.created_at),
      orderNumber: row.order_number,
      customerName: row.customer_name,
      status: row.status,
      total: this.toNumber(row.total),
      paidAmount: this.toNumber(row.paid_amount),
      ticketAvailable: true,
    }));
  }

  private async listPurchases(
    tenantId: string,
    cashSessionId: string,
    page: PageOptions
  ): Promise<CurrentShiftPurchaseRow[]> {
    const result = await this.db.query<PurchaseRow>(
      `/* current-shift: purchases */
      ${this.linkedPaymentsCte()}
      SELECT
        purchase.id::text AS id,
        MIN(linked_payment.created_at)::text AS created_at,
        supplier.name AS supplier_name,
        purchase.status,
        purchase.total::text AS total,
        COALESCE(SUM(linked_payment.amount), 0)::text AS paid_amount
      FROM linked_payment
      INNER JOIN purchases AS purchase
        ON purchase.id::text = linked_payment.reference_id
       AND purchase.tenant_id = $1
      LEFT JOIN suppliers AS supplier
        ON supplier.id = purchase.supplier_id
       AND supplier.tenant_id = purchase.tenant_id
      WHERE linked_payment.reference_type IN ('PURCHASE', 'PURCHASE_ORDER')
        AND (
          $3::text IS NULL
          OR supplier.name ILIKE '%' || $3::text || '%'
          OR purchase.id::text ILIKE '%' || $3::text || '%'
        )
      GROUP BY purchase.id, purchase.status, purchase.total, supplier.name
      ORDER BY MIN(linked_payment.created_at) DESC
      LIMIT $4
      OFFSET $5`,
      [tenantId, cashSessionId, page.search, page.pageSize, page.offset]
    );

    return result.rows.map((row) => ({
      id: row.id,
      createdAt: this.toIso(row.created_at),
      supplierName: row.supplier_name,
      status: row.status,
      total: this.toNumber(row.total),
      paidAmount: this.toNumber(row.paid_amount),
      ticketAvailable: true,
    }));
  }

  private async listMovements(
    tenantId: string,
    cashSessionId: string,
    page: PageOptions
  ): Promise<CurrentShiftMovementRow[]> {
    const result = await this.db.query<MovementRow>(
      `/* current-shift: movements */
      SELECT
        movement.id::text AS id,
        movement.created_at::text AS created_at,
        movement.movement_type AS type,
        movement.description,
        movement.amount::text AS amount,
        movement.direction,
        movement.reference_type,
        movement.reference_id
      FROM cash_movements AS movement
      WHERE movement.tenant_id = $1
        AND movement.cash_session_id = $2
        AND (
          $3::text IS NULL
          OR movement.description ILIKE '%' || $3::text || '%'
          OR movement.reference_id ILIKE '%' || $3::text || '%'
          OR movement.reference_type ILIKE '%' || $3::text || '%'
        )
      ORDER BY movement.created_at DESC
      LIMIT $4
      OFFSET $5`,
      [tenantId, cashSessionId, page.search, page.pageSize, page.offset]
    );

    return result.rows.map((row) => ({
      id: row.id,
      createdAt: this.toIso(row.created_at),
      type: row.type,
      description: row.description,
      amount: this.toNumber(row.amount),
      direction: row.direction,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
    }));
  }

  private async listCashCounts(
    tenantId: string,
    cashSessionId: string,
    page: PageOptions
  ): Promise<CurrentShiftCashCountRow[]> {
    const result = await this.db.query<CashCountRow>(
      `/* current-shift: cash-count */
      SELECT
        count_data.id::text AS id,
        count_data.counted_at::text AS created_at,
        count_data.expected_amount::text AS expected_amount,
        count_data.counted_cash_amount::text AS counted_amount,
        count_data.difference_amount::text AS difference,
        count_data.notes
      FROM cash_counts AS count_data
      WHERE count_data.tenant_id = $1
        AND count_data.cash_session_id = $2
        AND (
          $3::text IS NULL
          OR count_data.notes ILIKE '%' || $3::text || '%'
          OR count_data.id::text ILIKE '%' || $3::text || '%'
        )
      ORDER BY count_data.counted_at DESC
      LIMIT $4
      OFFSET $5`,
      [tenantId, cashSessionId, page.search, page.pageSize, page.offset]
    );

    return result.rows.map((row) => ({
      id: row.id,
      createdAt: this.toIso(row.created_at),
      expectedAmount: this.toNumber(row.expected_amount),
      countedAmount: this.toNumber(row.counted_amount),
      difference: this.toNumber(row.difference),
      notes: row.notes,
      ticketAvailable: true,
    }));
  }

  private buildSummary(
    cashSession: CurrentShiftCashSession,
    rawSummary: Record<string, unknown> | null,
    sales: CurrentShiftSaleRow[],
    orders: CurrentShiftOrderRow[],
    purchases: CurrentShiftPurchaseRow[],
    movements: CurrentShiftMovementRow[],
    cashCount: CurrentShiftCashCountRow[]
  ): CurrentShiftSummary {
    const totals = (rawSummary?.totals ?? {}) as Record<string, unknown>;
    const paymentsIn = this.toNumber(totals.paymentsIn);
    const paymentsOut = this.toNumber(totals.paymentsOut);
    const adjustmentsIn = this.toNumber(totals.adjustmentsIn);
    const adjustmentsOut = this.toNumber(totals.adjustmentsOut);
    const expenses = this.toNumber(totals.expenses);
    const withdrawals = this.toNumber(totals.withdrawals);
    const latestCount = cashCount[0] ?? null;

    return {
      openingAmount: this.toNumber(totals.openingAmount ?? cashSession.openingAmount),
      posSalesTotal: this.toNumber(
        totals.posSalesPayments ??
          totals.salesPayments ??
          sales.reduce((sum, row) => sum + row.paidAmount, 0)
      ),
      orderSalesTotal: this.toNumber(
        totals.orderSalesPayments ??
          orders.reduce((sum, row) => sum + row.paidAmount, 0)
      ),
      purchasesTotal: this.toNumber(
        totals.purchasePayments ??
          purchases.reduce((sum, row) => sum + row.paidAmount, 0)
      ),
      cashInTotal: this.toNumber(
        (paymentsIn || sales.reduce((sum, row) => sum + row.paidAmount, 0)) +
          adjustmentsIn
      ),
      cashOutTotal: this.toNumber(paymentsOut + expenses + withdrawals + adjustmentsOut),
      expectedAmount: this.toNumber(
        totals.expectedAmount ??
          cashSession.openingAmount +
            movements.reduce(
              (sum, row) => sum + (row.direction === "OUT" ? -row.amount : row.amount),
              0
            )
      ),
      currentCountAmount: latestCount ? latestCount.countedAmount : null,
      difference: latestCount ? latestCount.difference : null,
    };
  }

  private buildTickets(input: {
    sales: CurrentShiftSaleRow[];
    orders: CurrentShiftOrderRow[];
    purchases: CurrentShiftPurchaseRow[];
    cashCount: CurrentShiftCashCountRow[];
  }): CurrentShiftTicketRow[] {
    const tickets: CurrentShiftTicketRow[] = [];
    for (const row of input.sales) {
      if (row.ticketAvailable) {
        tickets.push({
          type: "POS_SALE",
          entityId: row.id,
          label: `Venta POS ${row.id.slice(0, 8)}`,
          createdAt: row.createdAt,
          viewUrl: `/reports/pos-sales/${row.id}/ticket`,
          downloadUrl: `/reports/pos-sales/${row.id}/ticket`,
          printable: true,
        });
      }
    }
    for (const row of input.orders) {
      if (row.ticketAvailable) {
        tickets.push({
          type: "ORDER",
          entityId: row.id,
          label: `Pedido ${(row.orderNumber ?? row.id).slice(0, 8)}`,
          createdAt: row.createdAt,
          viewUrl: `/reports/order-sales/${row.id}/ticket`,
          downloadUrl: `/reports/order-sales/${row.id}/ticket`,
          printable: true,
        });
      }
    }
    for (const row of input.purchases) {
      if (row.ticketAvailable) {
        tickets.push({
          type: "PURCHASE",
          entityId: row.id,
          label: `Compra ${row.id.slice(0, 8)}`,
          createdAt: row.createdAt,
          viewUrl: `/reports/purchases/${row.id}/ticket`,
          downloadUrl: `/reports/purchases/${row.id}/ticket`,
          printable: true,
        });
      }
    }
    for (const row of input.cashCount) {
      if (row.ticketAvailable) {
        tickets.push({
          type: "CASH_COUNT",
          entityId: row.id,
          label: `Arqueo ${row.id.slice(0, 8)}`,
          createdAt: row.createdAt,
          viewUrl: `/reports/cash-audits/${row.id}/ticket`,
          downloadUrl: `/reports/cash-audits/${row.id}/ticket`,
          printable: true,
        });
      }
    }
    return tickets.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getCurrentShift(
    query: CurrentShiftQuery,
    user?: ReportUser
  ): Promise<CurrentShiftResponse> {
    const actor = this.resolveActor(user);
    const tenantId = this.resolveTenant(actor, query);
    const branchId = this.normalizeUuid(query.branchId, "branchId") ?? actor.branchId ?? undefined;
    const terminalId = this.normalizeUuid(query.terminalId, "terminalId");
    const cashRegisterId = this.normalizeUuid(
      query.cashRegisterId,
      "cashRegisterId"
    );
    const cashSessionId = this.normalizeUuid(query.cashSessionId, "cashSessionId");
    const page = this.normalizePage(query);
    const sessionFilters = {
      branchId,
      terminalId,
      cashRegisterId,
    };
    const availableCashSessions = await this.listAvailableOpenSessions(
      actor,
      tenantId,
      sessionFilters
    );

    const session = cashSessionId
      ? await this.findSessionById(cashSessionId)
      : availableCashSessions[0] ?? null;

    if (!session) {
      return {
        hasOpenCashSession: false,
        message: "No hay caja abierta para el contexto operativo actual.",
        filters: {
          tenantId,
          branchId: branchId ?? null,
          terminalId: terminalId ?? null,
          cashRegisterId: cashRegisterId ?? null,
          cashSessionId: cashSessionId ?? null,
          actorRole: actor.role,
          page: page.page,
          pageSize: page.pageSize,
          search: page.search,
        },
        availableCashSessions,
        tabs: this.emptyTabs(),
      };
    }

    this.assertSessionScope(actor, tenantId, session, {
      ...query,
      branchId,
      terminalId,
      cashRegisterId,
      cashSessionId,
    });

    if (session.status !== "OPEN") {
      return {
        hasOpenCashSession: false,
        message: "La caja consultada no esta abierta.",
        cashSession: session,
        filters: {
          tenantId,
          branchId: session.branchId,
          terminalId: session.terminalId,
          cashRegisterId: session.cashRegisterId,
          cashSessionId: session.id,
          actorRole: actor.role,
          page: page.page,
          pageSize: page.pageSize,
          search: page.search,
        },
        availableCashSessions,
        tabs: this.emptyTabs(),
      };
    }

    const [rawSummary, sales, orders, purchases, movements, cashCount] =
      await Promise.all([
        this.getRawSummary(session.tenantId, session.id),
        this.listSales(session.tenantId, session.id, page),
        this.listOrders(session.tenantId, session.id, page),
        this.listPurchases(session.tenantId, session.id, page),
        this.listMovements(session.tenantId, session.id, page),
        this.listCashCounts(session.tenantId, session.id, page),
      ]);
    const tickets = this.buildTickets({ sales, orders, purchases, cashCount });

    return {
      hasOpenCashSession: true,
      message: null,
      cashSession: session,
      summary: this.buildSummary(
        session,
        rawSummary,
        sales,
        orders,
        purchases,
        movements,
        cashCount
      ),
      filters: {
        tenantId: session.tenantId,
        branchId: session.branchId,
        terminalId: session.terminalId,
        cashRegisterId: session.cashRegisterId,
        cashSessionId: session.id,
        actorRole: actor.role,
        page: page.page,
        pageSize: page.pageSize,
        search: page.search,
      },
      availableCashSessions,
      tabs: {
        sales: { total: sales.length, rows: sales },
        orders: { total: orders.length, rows: orders },
        purchases: { total: purchases.length, rows: purchases },
        movements: { total: movements.length, rows: movements },
        cashCount: { total: cashCount.length, rows: cashCount },
        tickets: { total: tickets.length, rows: tickets },
      },
    };
  }
}
