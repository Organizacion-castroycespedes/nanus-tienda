import { badRequest } from "../shared/errors";
import { parseIsoDate } from "../shared/dates";
import { parseMoney, parseQuantity } from "../shared/money";
import {
  asBody,
  optionalEnum,
  optionalInteger,
  optionalReason,
  requireEnum,
  requireReason,
  requireString,
  requireUuid,
  type Body,
} from "../shared/parsing";
import {
  BILLING_FREQUENCIES,
  ITEM_FREQUENCIES,
  TERM_PHASES,
  type BillingFrequency,
  type CustomItemInput,
  type PriceOverride,
  type TermPhase,
} from "./contract-items";

export const PRORATION_POLICIES = ["NONE", "DAILY"] as const;
export type ProrationPolicy = (typeof PRORATION_POLICIES)[number];

type Overrides = Partial<Record<"BASE" | "EXTRA_POS_TERMINAL", PriceOverride>>;

const parseCustomItems = (body: Body): CustomItemInput[] => {
  if (body.customItems === undefined || body.customItems === null) return [];
  if (!Array.isArray(body.customItems) || body.customItems.length > 20) {
    throw badRequest("CONTROL_CENTER_INVALID_FIELD", "customItems debe ser una lista de hasta 20 ítems");
  }
  return body.customItems.map((entry, index) => {
    const item = asBody(entry);
    return {
      description: requireString(item, "description", 200),
      quantity: parseQuantity(item.quantity ?? "1", `customItems[${index}].quantity`),
      unitAmount: parseMoney(item.unitAmount, `customItems[${index}].unitAmount`),
      billingFrequency: requireEnum(item, "billingFrequency", ITEM_FREQUENCIES),
      discountAmount: parseMoney(item.discountAmount ?? "0", `customItems[${index}].discountAmount`),
    };
  });
};

const parseOverrides = (body: Body): Overrides | undefined => {
  if (body.overrides === undefined || body.overrides === null) return undefined;
  const raw = asBody(body.overrides);
  const result: Overrides = {};
  for (const key of Object.keys(raw)) {
    if (key !== "BASE" && key !== "EXTRA_POS_TERMINAL") {
      throw badRequest("CONTROL_CENTER_INVALID_FIELD", "overrides solo admite BASE y EXTRA_POS_TERMINAL");
    }
    const entry = asBody(raw[key]);
    const override: PriceOverride = {};
    if (entry.unitAmount !== undefined) override.unitAmount = parseMoney(entry.unitAmount, `overrides.${key}.unitAmount`);
    if (entry.discountAmount !== undefined) override.discountAmount = parseMoney(entry.discountAmount, `overrides.${key}.discountAmount`);
    result[key] = override;
  }
  return result;
};

export type ContractCreateInput = {
  accountId: string;
  tenantId: string;
  planId: string;
  startDate: string;
  billingFrequency: BillingFrequency;
  extraPosTerminals: number;
  prorationPolicy: ProrationPolicy;
  trialMonths: number | null;
  customItems: CustomItemInput[];
  overrides?: Overrides;
  reason: string | null;
};

export const parseContractCreate = (raw: unknown): ContractCreateInput => {
  const body = asBody(raw);
  return {
    accountId: requireUuid(body, "accountId"),
    tenantId: requireUuid(body, "tenantId"),
    planId: requireUuid(body, "planId"),
    startDate: parseIsoDate(body.startDate, "startDate"),
    billingFrequency: requireEnum(body, "billingFrequency", BILLING_FREQUENCIES),
    extraPosTerminals: optionalInteger(body, "extraPosTerminals", 0, 500) ?? 0,
    prorationPolicy: optionalEnum(body, "prorationPolicy", PRORATION_POLICIES) ?? "DAILY",
    trialMonths: optionalInteger(body, "trialMonths", 0, 12),
    customItems: parseCustomItems(body),
    overrides: parseOverrides(body),
    reason: optionalReason(body),
  };
};

export type ContractAmendInput = {
  effectiveFrom: string;
  termPhase: TermPhase;
  billingFrequency: BillingFrequency;
  extraPosTerminals: number;
  prorationPolicy: ProrationPolicy | null;
  customItems: CustomItemInput[];
  overrides?: Overrides;
  reason: string;
};

export const parseContractAmend = (raw: unknown): ContractAmendInput => {
  const body = asBody(raw);
  return {
    effectiveFrom: parseIsoDate(body.effectiveFrom, "effectiveFrom"),
    termPhase: requireEnum(body, "termPhase", TERM_PHASES),
    billingFrequency: requireEnum(body, "billingFrequency", BILLING_FREQUENCIES),
    extraPosTerminals: optionalInteger(body, "extraPosTerminals", 0, 500) ?? 0,
    prorationPolicy: optionalEnum(body, "prorationPolicy", PRORATION_POLICIES),
    customItems: parseCustomItems(body),
    overrides: parseOverrides(body),
    reason: requireReason(body),
  };
};

export const parseContractEnd = (raw: unknown) => {
  const body = asBody(raw);
  return { endDate: parseIsoDate(body.endDate, "endDate"), reason: requireReason(body) };
};

export const parseIdempotencyKey = (value: unknown): string | null => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null || raw === "") return null;
  const key = String(raw).trim();
  if (!/^[A-Za-z0-9_\-:.]{8,120}$/.test(key)) {
    throw badRequest("CONTROL_CENTER_INVALID_IDEMPOTENCY_KEY", "Idempotency-Key debe tener entre 8 y 120 caracteres seguros");
  }
  return key;
};
