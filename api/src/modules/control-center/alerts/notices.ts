import type { ControlCenterQueryable } from "../control-center-database.service";
import type { AlertStage } from "./alert-stages";

/**
 * Mantiene el aviso del dashboard de un cargo después de un pago, un reverso o
 * una anulación: lo resuelve si ya no tiene saldo o actualiza el saldo vigente.
 */
export const syncChargeNotice = async (tx: ControlCenterQueryable, chargeId: string, status: string, balance: string) => {
  if (status === "PAID" || status === "VOID") {
    await tx.query(
      `UPDATE public.tenant_billing_notices SET resolved_at = NOW(), updated_at = NOW()
       WHERE charge_id = $1 AND resolved_at IS NULL`,
      [chargeId],
    );
    return;
  }
  await tx.query(
    `UPDATE public.tenant_billing_notices SET balance = $2, updated_at = NOW()
     WHERE charge_id = $1 AND resolved_at IS NULL AND balance IS DISTINCT FROM $2::numeric`,
    [chargeId, balance],
  );
};

export const resolveChargeNotices = async (tx: ControlCenterQueryable, chargeIds: string[]) => {
  if (chargeIds.length === 0) return;
  await tx.query(
    `UPDATE public.tenant_billing_notices SET resolved_at = NOW(), updated_at = NOW()
     WHERE charge_id = ANY($1::uuid[]) AND resolved_at IS NULL`,
    [chargeIds],
  );
};

export type NoticeInput = {
  tenantId: string;
  chargeId: string;
  chargeNumber: string;
  stage: AlertStage;
  dueDate: string;
  balance: string;
  periodStart: string;
  periodEnd: string;
};

/** Publica o actualiza el aviso activo del cargo (uno por cargo). */
export const upsertChargeNotice = (tx: ControlCenterQueryable, notice: NoticeInput) =>
  tx.query(
    `INSERT INTO public.tenant_billing_notices
       (tenant_id, charge_id, charge_number, stage, due_date, balance, period_start, period_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (charge_id) WHERE resolved_at IS NULL
     DO UPDATE SET stage = EXCLUDED.stage, balance = EXCLUDED.balance, due_date = EXCLUDED.due_date, updated_at = NOW()
     WHERE public.tenant_billing_notices.stage IS DISTINCT FROM EXCLUDED.stage
        OR public.tenant_billing_notices.balance IS DISTINCT FROM EXCLUDED.balance
        OR public.tenant_billing_notices.due_date IS DISTINCT FROM EXCLUDED.due_date`,
    [notice.tenantId, notice.chargeId, notice.chargeNumber, notice.stage, notice.dueDate, notice.balance, notice.periodStart, notice.periodEnd],
  );
