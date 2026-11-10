import type { ControlCenterQueryable } from "../control-center-database.service";
import { chargeStatusFor, planAutoAllocation } from "../billing/billing-periods";
import { conflict, notFound, unprocessable } from "../shared/errors";
import { fromCents, toCents } from "../shared/money";
import { syncChargeNotice } from "../alerts/notices";

export type AllocationRequest = { chargeId: string; amountCents: bigint };

type LockedReceipt = { id: string; account_id: string; status: string; amount: string; allocated_amount: string; receipt_number: string };
type LockedCharge = { id: string; account_id: string; contract_id: string; status: string; total_amount: string; paid_amount: string; charge_number: string };

export const lockReceipt = async (tx: ControlCenterQueryable, receiptId: string): Promise<LockedReceipt> => {
  const result = await tx.query(
    `SELECT id, account_id, status, amount::text, allocated_amount::text, receipt_number
     FROM control_center.receipts WHERE id = $1 FOR UPDATE`,
    [receiptId],
  );
  if (!result.rows[0]) throw notFound("CONTROL_CENTER_RECEIPT_NOT_FOUND", "Recaudo no encontrado");
  return result.rows[0];
};

/** Bloquea los cargos en orden de id para evitar interbloqueos entre operaciones concurrentes. */
const lockCharges = async (tx: ControlCenterQueryable, chargeIds: string[]): Promise<Map<string, LockedCharge>> => {
  if (chargeIds.length === 0) return new Map();
  const result = await tx.query(
    `SELECT id, account_id, contract_id, status, total_amount::text, paid_amount::text, charge_number
     FROM control_center.charges WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
    [chargeIds],
  );
  return new Map(result.rows.map((row: LockedCharge) => [row.id, row]));
};

/** Cargos abiertos de la cuenta (opcionalmente de un contrato), del vencimiento más antiguo al más nuevo. */
export const openChargesOldestFirst = async (tx: ControlCenterQueryable, accountId: string, contractId: string | null) => {
  const result = await tx.query(
    `SELECT id, (total_amount - paid_amount)::text AS balance
     FROM control_center.charges
     WHERE account_id = $1 AND status IN ('OPEN', 'PARTIALLY_PAID') AND ($2::uuid IS NULL OR contract_id = $2)
     ORDER BY due_date, created_at, id`,
    [accountId, contractId],
  );
  return result.rows.map((row: { id: string; balance: string }) => ({ id: row.id, balanceCents: toCents(row.balance) }));
};

/**
 * Aplica valor de un recaudo a cargos de la misma cuenta. Actualiza lo pagado
 * del cargo y lo aplicado del recaudo en la misma transacción; el trigger
 * diferido de V113 verifica los saldos al confirmar.
 */
export const applyAllocations = async (
  tx: ControlCenterQueryable,
  receiptId: string,
  requests: AllocationRequest[],
  actorUserId: string,
) => {
  const receipt = await lockReceipt(tx, receiptId);
  if (receipt.status !== "CONFIRMED") throw conflict("CONTROL_CENTER_RECEIPT_VOID", "El recaudo está anulado");
  const merged = new Map<string, bigint>();
  for (const request of requests) {
    if (request.amountCents <= 0n) throw unprocessable("CONTROL_CENTER_INVALID_AMOUNT", "Cada aplicación debe ser mayor que cero");
    merged.set(request.chargeId, (merged.get(request.chargeId) ?? 0n) + request.amountCents);
  }
  const charges = await lockCharges(tx, [...merged.keys()]);
  let total = 0n;
  for (const [chargeId, amount] of merged) {
    const charge = charges.get(chargeId);
    if (!charge) throw notFound("CONTROL_CENTER_CHARGE_NOT_FOUND", "Cargo no encontrado");
    if (charge.account_id !== receipt.account_id) {
      throw unprocessable("CONTROL_CENTER_ALLOCATION_ACCOUNT_MISMATCH", `El cargo ${charge.charge_number} pertenece a otra cuenta`);
    }
    if (charge.status !== "OPEN" && charge.status !== "PARTIALLY_PAID") {
      throw conflict("CONTROL_CENTER_CHARGE_NOT_OPEN", `El cargo ${charge.charge_number} no tiene saldo pendiente`);
    }
    const balance = toCents(charge.total_amount) - toCents(charge.paid_amount);
    if (amount > balance) {
      throw unprocessable("CONTROL_CENTER_ALLOCATION_EXCEEDS_BALANCE", `La aplicación supera el saldo del cargo ${charge.charge_number}`);
    }
    total += amount;
  }
  const available = toCents(receipt.amount) - toCents(receipt.allocated_amount);
  if (total > available) {
    throw unprocessable("CONTROL_CENTER_ALLOCATION_EXCEEDS_RECEIPT", "Las aplicaciones superan el valor disponible del recaudo");
  }
  const applied: { allocationId: string; chargeId: string; chargeNumber: string; amount: string }[] = [];
  for (const [chargeId, amount] of merged) {
    const charge = charges.get(chargeId)!;
    const inserted = await tx.query(
      `INSERT INTO control_center.receipt_allocations (receipt_id, charge_id, amount, created_by)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [receiptId, chargeId, fromCents(amount), actorUserId],
    );
    const paid = toCents(charge.paid_amount) + amount;
    const status = chargeStatusFor(toCents(charge.total_amount), paid);
    await tx.query(
      `UPDATE control_center.charges SET paid_amount = $2, status = $3, updated_by = $4, updated_at = NOW() WHERE id = $1`,
      [chargeId, fromCents(paid), status, actorUserId],
    );
    await syncChargeNotice(tx, chargeId, status, fromCents(toCents(charge.total_amount) - paid));
    applied.push({ allocationId: inserted.rows[0].id, chargeId, chargeNumber: charge.charge_number, amount: fromCents(amount) });
  }
  if (total > 0n) {
    await tx.query(
      `UPDATE control_center.receipts SET allocated_amount = allocated_amount + $2::numeric, updated_by = $3, updated_at = NOW() WHERE id = $1`,
      [receiptId, fromCents(total), actorUserId],
    );
  }
  return { receipt, applied, totalCents: total };
};

/** Aplica automáticamente el disponible del recaudo, del cargo más antiguo al más nuevo. */
export const autoAllocate = async (
  tx: ControlCenterQueryable,
  receiptId: string,
  actorUserId: string,
  contractId: string | null = null,
) => {
  const receipt = await lockReceipt(tx, receiptId);
  const available = toCents(receipt.amount) - toCents(receipt.allocated_amount);
  const open = await openChargesOldestFirst(tx, receipt.account_id, contractId);
  const plan = planAutoAllocation(available, open);
  if (plan.allocations.length === 0) return { receipt, applied: [], totalCents: 0n };
  return applyAllocations(tx, receiptId, plan.allocations, actorUserId);
};

type LockedAllocation = { id: string; receipt_id: string; charge_id: string; amount: string; reversed_at: string | null };

/** Revierte una aplicación (una sola vez) y recalcula el cargo y el recaudo. */
export const reverseAllocationInTx = async (
  tx: ControlCenterQueryable,
  allocationId: string,
  reason: string,
  actorUserId: string,
) => {
  const found = await tx.query(
    `SELECT id, receipt_id, charge_id, amount::text, reversed_at FROM control_center.receipt_allocations WHERE id = $1`,
    [allocationId],
  );
  const allocation: LockedAllocation | undefined = found.rows[0];
  if (!allocation) throw notFound("CONTROL_CENTER_ALLOCATION_NOT_FOUND", "Aplicación no encontrada");
  await lockReceipt(tx, allocation.receipt_id);
  const charges = await lockCharges(tx, [allocation.charge_id]);
  const locked = await tx.query(
    `SELECT reversed_at FROM control_center.receipt_allocations WHERE id = $1 FOR UPDATE`,
    [allocationId],
  );
  if (locked.rows[0]?.reversed_at) throw conflict("CONTROL_CENTER_ALLOCATION_ALREADY_REVERSED", "La aplicación ya fue revertida");
  const charge = charges.get(allocation.charge_id)!;
  const amount = toCents(allocation.amount);
  await tx.query(
    `UPDATE control_center.receipt_allocations SET reversed_at = NOW(), reversed_by = $2, reversal_reason = $3 WHERE id = $1`,
    [allocationId, actorUserId, reason],
  );
  const paid = toCents(charge.paid_amount) - amount;
  const status = chargeStatusFor(toCents(charge.total_amount), paid);
  await tx.query(
    `UPDATE control_center.charges SET paid_amount = $2, status = $3, updated_by = $4, updated_at = NOW() WHERE id = $1`,
    [charge.id, fromCents(paid), status, actorUserId],
  );
  await syncChargeNotice(tx, charge.id, status, fromCents(toCents(charge.total_amount) - paid));
  await tx.query(
    `UPDATE control_center.receipts SET allocated_amount = allocated_amount - $2::numeric, updated_by = $3, updated_at = NOW() WHERE id = $1`,
    [allocation.receipt_id, allocation.amount, actorUserId],
  );
  return { allocationId, receiptId: allocation.receipt_id, chargeId: charge.id, chargeNumber: charge.charge_number, amount: allocation.amount };
};
