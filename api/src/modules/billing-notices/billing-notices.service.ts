import { Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../../common/db/database.service";

export type BillingNotice = {
  id: string;
  chargeNumber: string;
  stage: "UPCOMING" | "DUE" | "OVERDUE_1" | "OVERDUE_7" | "OVERDUE_15" | "OVERDUE_30";
  dueDate: string;
  balance: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  updatedAt: string;
};

type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

/**
 * Avisos de cobro de MANUS para el tenant del usuario. Los publica el Control
 * Center en public.tenant_billing_notices; la API operativa solo los lee.
 */
@Injectable()
export class BillingNoticesService {
  constructor(@Inject(DatabaseService) private readonly db: Queryable) {}

  async activeForTenant(tenantId: string | undefined): Promise<BillingNotice[]> {
    if (!tenantId) return [];
    try {
      const result = await this.db.query(
        `SELECT id, charge_number AS "chargeNumber", stage, due_date::text AS "dueDate", balance::text AS balance,
                currency, period_start::text AS "periodStart", period_end::text AS "periodEnd", updated_at AS "updatedAt"
         FROM public.tenant_billing_notices
         WHERE tenant_id = $1 AND resolved_at IS NULL
         ORDER BY due_date, charge_number
         LIMIT 20`,
        [tenantId],
      );
      return result.rows;
    } catch (error) {
      // Sin la migración V114 o sin permiso de lectura no hay avisos: el dashboard no debe fallar.
      const code = (error as { code?: string })?.code;
      if (code === "42P01" || code === "42501") return [];
      throw error;
    }
  }
}
