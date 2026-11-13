import { parseIsoDate } from "../shared/dates";
import { badRequest } from "../shared/errors";
import { parseMoney, toCents } from "../shared/money";
import { asBody, assertUuid, optionalString, requireUuid, type Body } from "../shared/parsing";
import type { AllocationRequest } from "./allocations";

export type ReceiptCreateInput = {
  accountId: string;
  receivedOn: string;
  amountCents: bigint;
  paymentMethodId: string;
  financialInstitutionId: string | null;
  reference: string | null;
  notes: string | null;
  allocations: AllocationRequest[];
  autoAllocate: boolean;
};

const MAX_ALLOCATIONS = 50;

/** Acepta booleanos de JSON o de formularios multipart ("true"/"false"). */
const flag = (body: Body, field: string): boolean => {
  const value = body[field];
  if (value === undefined || value === null || value === "") return false;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw badRequest("CONTROL_CENTER_INVALID_FIELD", `${field} debe ser verdadero o falso`);
};

const positiveCents = (value: unknown, field: string) => {
  const cents = toCents(parseMoney(value, field));
  if (cents <= 0n) throw badRequest("CONTROL_CENTER_INVALID_AMOUNT", `${field} debe ser mayor que cero`);
  return cents;
};

/** Lista de aplicaciones [{ chargeId, amount }], como arreglo o como texto JSON (multipart). */
export const parseAllocationList = (value: unknown): AllocationRequest[] => {
  if (value === undefined || value === null || value === "") return [];
  let list = value;
  if (typeof value === "string") {
    try {
      list = JSON.parse(value);
    } catch {
      throw badRequest("CONTROL_CENTER_INVALID_FIELD", "allocations debe ser una lista JSON");
    }
  }
  if (!Array.isArray(list)) throw badRequest("CONTROL_CENTER_INVALID_FIELD", "allocations debe ser una lista");
  if (list.length > MAX_ALLOCATIONS) throw badRequest("CONTROL_CENTER_INVALID_FIELD", `Máximo ${MAX_ALLOCATIONS} aplicaciones`);
  return list.map((entry, index) => {
    const item = asBody(entry);
    return {
      chargeId: assertUuid(item.chargeId, `allocations[${index}].chargeId`),
      amountCents: positiveCents(item.amount, `allocations[${index}].amount`),
    };
  });
};

export const parseReceiptCreate = (raw: unknown): ReceiptCreateInput => {
  const body = asBody(raw);
  const allocations = parseAllocationList(body.allocations);
  const autoAllocate = flag(body, "autoAllocate");
  if (autoAllocate && allocations.length > 0) {
    throw badRequest("CONTROL_CENTER_INVALID_FIELD", "Usa aplicación automática o aplicaciones manuales, no ambas");
  }
  const financialInstitutionId = optionalString(body, "financialInstitutionId", 64);
  return {
    accountId: requireUuid(body, "accountId"),
    receivedOn: parseIsoDate(body.receivedOn, "receivedOn"),
    amountCents: positiveCents(body.amount, "amount"),
    paymentMethodId: requireUuid(body, "paymentMethodId"),
    financialInstitutionId: financialInstitutionId ? assertUuid(financialInstitutionId, "financialInstitutionId") : null,
    reference: optionalString(body, "reference", 120),
    notes: optionalString(body, "notes", 1000),
    allocations,
    autoAllocate,
  };
};

export const parseAllocationBody = (raw: unknown) => {
  const body = asBody(raw ?? {});
  const allocations = parseAllocationList(body.allocations);
  const autoAllocate = flag(body, "autoAllocate");
  if (autoAllocate === (allocations.length > 0)) {
    throw badRequest("CONTROL_CENTER_INVALID_FIELD", "Indica aplicaciones manuales o autoAllocate");
  }
  return { allocations, autoAllocate };
};
