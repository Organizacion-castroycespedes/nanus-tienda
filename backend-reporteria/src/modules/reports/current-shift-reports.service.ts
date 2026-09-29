import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { QueryResultRow } from "pg";
import { DatabaseService } from "../database/database.service";
import type { ReportUser } from "../auth/report-auth.types";
import { ReportBranchScopeService } from "../auth/report-branch-scope.service";
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
  CurrentShiftUserOption,
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

type DeliverySummaryRow = QueryResultRow & {
  delivered_count: string | number;
  pending_count: string | number;
  excluded_count: string | number;
  delivered_fee_total: string | number;
  by_payment_method: Array<{
    paymentMethodId: string | null;
    paymentMethodNombre: string | null;
    count: string | number;
    total: string | number;
  }>;
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
  operatorUserId?: string;
};

@Injectable()
export class CurrentShiftReportsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ReportBranchScopeService)
    private readonly branchScope: ReportBranchScopeService
  ) {}

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

  /** Calendar day of "turno actual" in America/Bogota (not full multi-day session). */
  private currentShiftDaySql(columnSql: string) {
    return `(${columnSql} AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date`;
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

  private noOpenSessionResponse(
    tenantId: string,
    branchId: string | null,
    terminalId: string | null,
    cashRegisterId: string | null,
    cashSessionId: string | null,
    userId: string | null,
    actorRole: string,
    page: PageOptions,
    availableCashSessions: CurrentShiftCashSession[],
    availableUsers: CurrentShiftUserOption[],
    message: string
  ): CurrentShiftResponse {
    return {
      hasOpenCashSession: false,
      message,
      filters: {
        tenantId,
        userId,
        branchId,
        terminalId,
        cashRegisterId,
        cashSessionId,
        actorRole,
        page: page.page,
        pageSize: page.pageSize,
        search: page.search,
      },
      availableCashSessions,
      availableUsers,
      tabs: this.emptyTabs(),
    };
  }

  private buildAvailableUsers(
    sessions: CurrentShiftCashSession[]
  ): CurrentShiftUserOption[] {
    const users = new Map<string, CurrentShiftUserOption>();
    for (const session of sessions) {
      if (!users.has(session.userId)) {
        users.set(session.userId, { id: session.userId, name: session.userName });
      }
    }
    return [...users.values()].sort((left, right) =>
      (left.name ?? left.id).localeCompare(right.name ?? right.id)
    );
  }

  private async listSessionOperatorUsers(
    tenantId: string,
    sessions: CurrentShiftCashSession[]
  ): Promise<CurrentShiftUserOption[]> {
    const users = new Map<string, CurrentShiftUserOption>();
    for (const session of sessions) {
      if (!users.has(session.userId)) {
        users.set(session.userId, { id: session.userId, name: session.userName });
      }
    }

    if (sessions.length === 0) {
      return [];
    }

    const registerIds = [...new Set(sessions.map((session) => session.cashRegisterId))];
    const sessionIds = sessions.map((session) => session.id);

    const assigneeResult = await this.db.query<{
      user_id: string;
      user_email: string | null;
    }>(
      `/* current-shift: session-assignees */
       SELECT DISTINCT
         assignment.user_id::text AS user_id,
         assigned_user.email AS user_email
       FROM public.cash_register_user_assignments AS assignment
       LEFT JOIN public.users AS assigned_user
         ON assigned_user.id = assignment.user_id
        AND assigned_user.tenant_id = $1
       WHERE assignment.cash_register_id = ANY($2::uuid[])
         AND assignment.unassigned_at IS NULL`,
      [tenantId, registerIds]
    );

    for (const row of assigneeResult.rows ?? []) {
      if (!users.has(row.user_id)) {
        users.set(row.user_id, {
          id: row.user_id,
          name: row.user_email,
        });
      }
    }

    const sellerResult = await this.db.query<{
      user_id: string;
      user_email: string | null;
    }>(
      `/* current-shift: session-sellers */
       SELECT DISTINCT
         sale.user_id::text AS user_id,
         seller.email AS user_email
       FROM public.payments AS payment
       INNER JOIN public.sales AS sale
         ON sale.id = payment.reference_id
        AND sale.tenant_id = payment.tenant_id
       LEFT JOIN public.users AS seller
         ON seller.id = sale.user_id
        AND seller.tenant_id = payment.tenant_id
       WHERE payment.tenant_id = $1
         AND payment.cash_session_id = ANY($2::uuid[])
         AND payment.reference_type = 'SALE'
         AND payment.status IN ('PENDING', 'COMPLETED')
         AND ${this.currentShiftDaySql("payment.created_at")}
         AND sale.user_id IS NOT NULL`,
      [tenantId, sessionIds]
    );

    for (const row of sellerResult.rows ?? []) {
      if (!users.has(row.user_id)) {
        users.set(row.user_id, {
          id: row.user_id,
          name: row.user_email,
        });
      }
    }

    return [...users.values()].sort((left, right) =>
      (left.name ?? left.id).localeCompare(right.name ?? right.id)
    );
  }

  private async hasUserCompletedClosure(
    tenantId: string,
    cashSessionId: string,
    userId: string
  ) {
    const result = await this.db.query<{ completed: boolean }>(
      `/* current-shift: user-closure */
       SELECT EXISTS (
         SELECT 1
         FROM public.cash_counts AS count_data
         WHERE count_data.tenant_id = $1
           AND count_data.cash_session_id = $2
           AND count_data.counted_by_user_id = $3
           AND count_data.count_type = 'CLOSING'
       ) AS completed`,
      [tenantId, cashSessionId, userId]
    );
    return Boolean(result.rows[0]?.completed);
  }

  private emptyDeliverySummary(): CurrentShiftSummary["deliverySummary"] {
    return {
      deliveredCount: 0,
      pendingCount: 0,
      excludedCount: 0,
      deliveredFeeTotal: 0,
      byPaymentMethod: [],
    };
  }

  private async hasDeliveryCashSchema() {
    const result = await this.db.query<{ has_schema: boolean }>(
      `
        SELECT (
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
        ) AS has_schema
      `
    );

    return Boolean(result.rows[0]?.has_schema);
  }

  private async getDeliveryCashSummary(
    tenantId: string,
    cashSessionId: string,
    operatorUserId?: string
  ): Promise<CurrentShiftSummary["deliverySummary"]> {
    if (!(await this.hasDeliveryCashSchema())) {
      return this.emptyDeliverySummary();
    }

    const params: unknown[] = [tenantId, cashSessionId];
    const operatorFilter = operatorUserId
      ? `AND delivery.created_by_user_id = $${params.push(operatorUserId)}`
      : "";

    const result = await this.db.query<DeliverySummaryRow>(
      `
        WITH delivery_scope AS (
          SELECT
            delivery.status,
            delivery.delivery_fee,
            delivery.payment_method_id,
            method.nombre AS payment_method_nombre
          FROM public.deliveries AS delivery
          LEFT JOIN public.payment_methods AS method
            ON method.id = delivery.payment_method_id
            AND method.tenant_id = delivery.tenant_id
          WHERE delivery.tenant_id = $1
            AND delivery.cash_session_id = $2
            AND ${this.currentShiftDaySql("delivery.created_at")}
            ${operatorFilter}
        ),
        payment_breakdown AS (
          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'paymentMethodId', item.payment_method_id,
                'paymentMethodNombre', item.payment_method_nombre,
                'count', item.total_count,
                'total', item.total_amount
              )
              ORDER BY item.payment_method_nombre NULLS LAST
            ),
            '[]'::jsonb
          ) AS data
          FROM (
            SELECT
              payment_method_id,
              payment_method_nombre,
              COUNT(*)::integer AS total_count,
              ROUND(SUM(delivery_fee), 2) AS total_amount
            FROM delivery_scope
            WHERE status IN ('ENTREGADO', 'DELIVERED')
              AND delivery_fee > 0
            GROUP BY payment_method_id, payment_method_nombre
          ) AS item
        ),
        summary AS (
          SELECT
            COUNT(*) FILTER (
              WHERE status IN ('ENTREGADO', 'DELIVERED')
            ) AS delivered_count,
            COUNT(*) FILTER (
              WHERE status IN (
                'CREADO',
                'CREATED',
                'EN_PREPARACION',
                'ASSIGNED',
                'DESPACHADO',
                'DISPATCHED'
              )
            ) AS pending_count,
            COUNT(*) FILTER (
              WHERE status IN ('CANCELADO', 'CANCELLED', 'NO_ENTREGADO', 'NOT_DELIVERED')
            ) AS excluded_count,
            COALESCE(SUM(delivery_fee) FILTER (
              WHERE status IN ('ENTREGADO', 'DELIVERED')
            ), 0) AS delivered_fee_total
          FROM delivery_scope
        )
        SELECT
          summary.delivered_count,
          summary.pending_count,
          summary.excluded_count,
          summary.delivered_fee_total,
          payment_breakdown.data AS by_payment_method
        FROM summary
        CROSS JOIN payment_breakdown
      `,
      params
    );

    const row = result.rows[0];
    if (!row) {
      return this.emptyDeliverySummary();
    }

    return {
      deliveredCount: this.toNumber(row.delivered_count),
      pendingCount: this.toNumber(row.pending_count),
      excludedCount: this.toNumber(row.excluded_count),
      deliveredFeeTotal: this.toNumber(row.delivered_fee_total),
      byPaymentMethod: (row.by_payment_method ?? []).map((item) => ({
        paymentMethodId: item.paymentMethodId,
        paymentMethodNombre: item.paymentMethodNombre,
        count: this.toNumber(item.count),
        total: this.toNumber(item.total),
      })),
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

  private async assertSessionScope(
    actor: CurrentShiftActorContext,
    tenantId: string,
    session: CurrentShiftCashSession,
    query: CurrentShiftQuery,
    authorizedBranchIds: string[]
  ) {
    if (session.tenantId !== tenantId) {
      throw new ForbiddenException("No autorizado para otro tenant");
    }

    if (!authorizedBranchIds.includes(session.branchId)) {
      throw new ForbiddenException("No autorizado para otra sucursal");
    }

    if (actor.role === "USER" && session.userId !== actor.userId) {
      const assignment = await this.db.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1
           FROM public.cash_register_user_assignments AS assignment
           WHERE assignment.cash_register_id = $1
             AND assignment.user_id = $2
             AND assignment.unassigned_at IS NULL
         ) AS exists`,
        [session.cashRegisterId, actor.userId]
      );
      if (!assignment.rows[0]?.exists) {
        throw new ForbiddenException("No autorizado para otra caja");
      }
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
    filters: SessionFilters & { branchIds: string[] }
  ) {
    const params: unknown[] = [tenantId];
    const where = [
      "session.tenant_id = $1",
      "session.status = 'OPEN'",
    ];
    const effectiveBranchId =
      filters.branchId ?? undefined;

    if (!effectiveBranchId) {
      params.push(filters.branchIds);
      where.push(`session.branch_id = ANY($${params.length}::uuid[])`);
    }

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

    const requireOwnSession = actor.role === "USER";

    if (requireOwnSession) {
      params.push(actor.userId);
      where.push(`(
        session.opened_by_user_id = $${params.length}
        OR EXISTS (
          SELECT 1
          FROM cash_register_user_assignments AS assignment
          WHERE assignment.cash_register_id = session.cash_register_id
            AND assignment.user_id = $${params.length}
            AND assignment.unassigned_at IS NULL
        )
      )`);
    }

    if (filters.operatorUserId && !requireOwnSession) {
      params.push(filters.operatorUserId);
      const operatorParamIndex = params.length;
      where.push(`(
        session.opened_by_user_id = $${operatorParamIndex}
        OR EXISTS (
          SELECT 1
          FROM cash_register_user_assignments AS selected_assignment
          WHERE selected_assignment.cash_register_id = session.cash_register_id
            AND selected_assignment.user_id = $${operatorParamIndex}
            AND selected_assignment.unassigned_at IS NULL
        )
      )`);
    }

    // Do NOT hide OPEN sessions after USER delivered closing: turno/POS still need
    // the live session and the user's sales while the caja remains open.

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
      actor.role === "USER" ||
      (!effectiveBranchId &&
        (actor.role === "ADMIN" ||
          (!this.isSuperAdmin(actor) && !this.isSuperUser(actor))));

    if (requireOwnSession) {
      where.push(`(
        session.opened_by_user_id = $${actorUserParamIndex}
        OR EXISTS (
          SELECT 1
          FROM cash_register_user_assignments AS assignment
          WHERE assignment.cash_register_id = session.cash_register_id
            AND assignment.user_id = $${actorUserParamIndex}
            AND assignment.unassigned_at IS NULL
        )
      )`);
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

  private async getTodayShiftTotals(
    tenantId: string,
    cashSessionId: string,
    userId?: string
  ) {
    const result = await this.db.query<{
      sales_total: string;
      orders_total: string;
      purchases_total: string;
    }>(
      `/* current-shift: today-totals */
      ${this.linkedPaymentsCte()}
      SELECT
        COALESCE((
          SELECT SUM(lp.amount)
          FROM linked_payment AS lp
          INNER JOIN sales AS sale
            ON sale.id::text = lp.reference_id
           AND sale.tenant_id = $1
          WHERE lp.reference_type = 'SALE'
            AND ${this.currentShiftDaySql("lp.created_at")}
            AND ($3::uuid IS NULL OR sale.user_id = $3::uuid)
        ), 0)::text AS sales_total,
        COALESCE((
          SELECT SUM(lp.amount)
          FROM linked_payment AS lp
          WHERE lp.reference_type = 'SALES_ORDER'
            AND ${this.currentShiftDaySql("lp.created_at")}
            AND ($3::uuid IS NULL OR lp.created_by = $3::uuid)
        ), 0)::text AS orders_total,
        COALESCE((
          SELECT SUM(lp.amount)
          FROM linked_payment AS lp
          WHERE lp.reference_type IN ('PURCHASE', 'PURCHASE_ORDER')
            AND ${this.currentShiftDaySql("lp.created_at")}
            AND ($3::uuid IS NULL OR lp.created_by = $3::uuid)
        ), 0)::text AS purchases_total`,
      [tenantId, cashSessionId, userId ?? null]
    );

    const row = result.rows[0];
    return {
      salesTotal: this.toNumber(row?.sales_total),
      ordersTotal: this.toNumber(row?.orders_total),
      purchasesTotal: this.toNumber(row?.purchases_total),
    };
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
        payment.created_by,
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
    userId: string | undefined,
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
        AND ${this.currentShiftDaySql("linked_payment.created_at")}
        AND ($6::uuid IS NULL OR sale.user_id = $6::uuid)
        AND (
          $3::text IS NULL
          OR customer.name ILIKE '%' || $3::text || '%'
          OR sale.id::text ILIKE '%' || $3::text || '%'
        )
      GROUP BY sale.id, sale.status, sale.total, customer.name
      ORDER BY MIN(linked_payment.created_at) DESC
      LIMIT $4
      OFFSET $5`,
      [tenantId, cashSessionId, page.search, page.pageSize, page.offset, userId ?? null]
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
    page: PageOptions,
    userId?: string
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
        AND ${this.currentShiftDaySql("linked_payment.created_at")}
        AND ($6::uuid IS NULL OR linked_payment.created_by = $6::uuid)
        AND (
          $3::text IS NULL
          OR customer.name ILIKE '%' || $3::text || '%'
          OR ord.id::text ILIKE '%' || $3::text || '%'
        )
      GROUP BY ord.id, ord.status, ord.total, customer.name
      ORDER BY MIN(linked_payment.created_at) DESC
      LIMIT $4
      OFFSET $5`,
      [tenantId, cashSessionId, page.search, page.pageSize, page.offset, userId ?? null]
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
    page: PageOptions,
    userId?: string
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
        AND ${this.currentShiftDaySql("linked_payment.created_at")}
        AND ($6::uuid IS NULL OR linked_payment.created_by = $6::uuid)
        AND (
          $3::text IS NULL
          OR supplier.name ILIKE '%' || $3::text || '%'
          OR purchase.id::text ILIKE '%' || $3::text || '%'
        )
      GROUP BY purchase.id, purchase.status, purchase.total, supplier.name
      ORDER BY MIN(linked_payment.created_at) DESC
      LIMIT $4
      OFFSET $5`,
      [tenantId, cashSessionId, page.search, page.pageSize, page.offset, userId ?? null]
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
    page: PageOptions,
    userId?: string
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
        AND ${this.currentShiftDaySql("movement.created_at")}
        AND ($6::uuid IS NULL OR movement.created_by = $6::uuid)
        AND (
          $3::text IS NULL
          OR movement.description ILIKE '%' || $3::text || '%'
          OR movement.reference_id::text ILIKE '%' || $3::text || '%'
          OR movement.reference_type ILIKE '%' || $3::text || '%'
        )
      ORDER BY movement.created_at DESC
      LIMIT $4
      OFFSET $5`,
      [tenantId, cashSessionId, page.search, page.pageSize, page.offset, userId ?? null]
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
    page: PageOptions,
    countedByUserId?: string
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
        AND ($4::uuid IS NULL OR count_data.counted_by_user_id = $4)
        AND ${this.currentShiftDaySql("count_data.counted_at")}
        AND (
          $3::text IS NULL
          OR count_data.notes ILIKE '%' || $3::text || '%'
          OR count_data.id::text ILIKE '%' || $3::text || '%'
        )
      ORDER BY count_data.counted_at DESC
      LIMIT $5
      OFFSET $6`,
      [
        tenantId,
        cashSessionId,
        page.search,
        countedByUserId ?? null,
        page.pageSize,
        page.offset,
      ]
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
    dayTotals: {
      salesTotal: number;
      ordersTotal: number;
      purchasesTotal: number;
    },
    cashCount: CurrentShiftCashCountRow[],
    deliverySummary: CurrentShiftSummary["deliverySummary"],
    options?: { scopedToUser?: boolean; salesUserId?: string | null }
  ): CurrentShiftSummary {
    const latestCount = cashCount[0] ?? null;
    const deliveryFees = this.toNumber(deliverySummary.deliveredFeeTotal);
    const salesTotal = this.toNumber(dayTotals.salesTotal);
    const ordersTotal = this.toNumber(dayTotals.ordersTotal);
    const purchasesTotal = this.toNumber(dayTotals.purchasesTotal);

    // Turno actual = calendar day (America/Bogota). Opening only counts for the opener
    // when scoped to a user; full session opening when viewing the whole caja today.
    const openingAmount =
      options?.scopedToUser
        ? options.salesUserId && cashSession.userId === options.salesUserId
          ? this.toNumber(cashSession.openingAmount)
          : 0
        : this.toNumber(cashSession.openingAmount);

    const cashInTotal = this.toNumber(salesTotal + ordersTotal + deliveryFees);
    const cashOutTotal = this.toNumber(purchasesTotal);
    // Do not fold raw movements: PAYMENT rows would double-count sales/orders.
    const expectedAmount = this.toNumber(openingAmount + cashInTotal - cashOutTotal);

    return {
      openingAmount,
      posSalesTotal: salesTotal,
      orderSalesTotal: ordersTotal,
      purchasesTotal,
      deliveryFees,
      deliverySummary,
      cashInTotal,
      cashOutTotal,
      expectedAmount,
      currentCountAmount: latestCount ? latestCount.countedAmount : null,
      difference: latestCount
        ? this.toNumber(latestCount.countedAmount - expectedAmount)
        : null,
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
    const requestedTenantId = this.normalizeUuid(query.tenantId, "tenantId");
    const requestedBranchId = this.normalizeUuid(query.branchId, "branchId");
    const scope = await this.branchScope.resolve(
      user,
      requestedBranchId,
      requestedTenantId
    );
    const tenantId = scope.tenantId;
    const requestedUserId = this.normalizeUuid(query.userId, "userId");
    const salesUserId = actor.role === "USER" ? actor.userId : requestedUserId;
    const branchId = requestedBranchId;
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
      operatorUserId: actor.role === "USER" ? actor.userId : requestedUserId,
      branchIds: scope.branchIds,
    };
    const availableCashSessions = await this.listAvailableOpenSessions(
      actor,
      tenantId,
      sessionFilters
    );
    const availableUsers =
      actor.role === "USER"
        ? this.buildAvailableUsers(availableCashSessions)
        : await this.listSessionOperatorUsers(tenantId, availableCashSessions);
    // Keep all open sessions in scope; salesUserId filters sales rows, not session list.
    const sessionsForSelection = availableCashSessions;

    const session = cashSessionId
      ? await this.findSessionById(cashSessionId)
      : sessionsForSelection[0] ?? null;

    if (!session) {
      return this.noOpenSessionResponse(
        tenantId,
        branchId ?? null,
        terminalId ?? null,
        cashRegisterId ?? null,
        cashSessionId ?? null,
        salesUserId ?? null,
        actor.role,
        page,
        availableCashSessions,
        availableUsers,
        "No hay caja abierta para el contexto operativo actual."
      );
    }

    await this.assertSessionScope(actor, tenantId, session, {
      ...query,
      branchId,
      terminalId,
      cashRegisterId,
      cashSessionId,
    }, scope.branchIds);

    if (
      actor.role !== "USER" &&
      salesUserId &&
      !availableUsers.some((user) => user.id === salesUserId)
    ) {
      throw new ForbiddenException("El usuario seleccionado no opera esta caja");
    }

    const ownClosureDelivered =
      actor.role === "USER" &&
      (await this.hasUserCompletedClosure(tenantId, session.id, actor.userId));

    if (session.status !== "OPEN") {
      return {
        hasOpenCashSession: false,
        message: "La caja consultada no esta abierta.",
        cashSession: session,
        filters: {
          tenantId,
          userId: salesUserId ?? null,
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
        availableUsers,
        tabs: this.emptyTabs(),
      };
    }

    const [dayTotals, sales, orders, purchases, movements, cashCount, deliverySummary] =
      await Promise.all([
        this.getTodayShiftTotals(
          session.tenantId,
          session.id,
          salesUserId ?? undefined
        ),
        this.listSales(session.tenantId, session.id, salesUserId, page),
        this.listOrders(session.tenantId, session.id, page, salesUserId),
        this.listPurchases(session.tenantId, session.id, page, salesUserId),
        this.listMovements(session.tenantId, session.id, page, salesUserId),
        this.listCashCounts(
          session.tenantId,
          session.id,
          page,
          actor.role === "USER" ? actor.userId : salesUserId ?? undefined
        ),
        this.getDeliveryCashSummary(
          session.tenantId,
          session.id,
          salesUserId ?? undefined
        ),
      ]);
    const tickets = this.buildTickets({ sales, orders, purchases, cashCount });

    return {
      hasOpenCashSession: true,
      message: ownClosureDelivered
        ? "Ya entregaste tu cierre. Puedes consultar tus ventas del turno en solo lectura."
        : null,
      cashSession: session,
      summary: this.buildSummary(session, dayTotals, cashCount, deliverySummary, {
        scopedToUser: Boolean(salesUserId),
        salesUserId: salesUserId ?? null,
      }),
      filters: {
        tenantId: session.tenantId,
        userId: salesUserId ?? null,
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
      availableUsers,
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
