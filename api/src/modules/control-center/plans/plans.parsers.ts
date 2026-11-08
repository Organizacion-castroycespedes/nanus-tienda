import { badRequest } from "../shared/errors";
import { parseIsoDate } from "../shared/dates";
import { parseMoney } from "../shared/money";
import {
  asBody,
  optionalBoolean,
  optionalInteger,
  optionalString,
  requireInteger,
  requireReason,
  requireString,
  requireUuid,
} from "../shared/parsing";
import { BILLING_FREQUENCIES, type PriceComponent, type PriceComponentCode } from "../contracts/contract-items";

export const PRICE_COMPONENTS: readonly PriceComponentCode[] = [
  "BASE_INITIAL_TERM",
  "BASE_RENEWAL",
  "EXTRA_POS_TERMINAL",
  "CERTIFICATION",
];

export type PlanCreateInput = { code: string; name: string; description: string | null };
export type PlanPatchInput = { name?: string; description?: string | null; retire?: boolean; reason?: string };

export type PriceVersionInput = {
  validFrom: string;
  taxId: string;
  pricesIncludeTax: boolean | null;
  includedPosTerminals: number;
  initialTermMonths: number;
  defaultTrialMonths: number;
  components: PriceComponent[];
  reason: string;
};

export const parsePlanCreate = (raw: unknown): PlanCreateInput => {
  const body = asBody(raw);
  const code = requireString(body, "code", 40).toUpperCase().replace(/[\s-]+/g, "_");
  if (!/^[A-Z0-9_]{3,40}$/.test(code)) {
    throw badRequest("CONTROL_CENTER_INVALID_FIELD", "code debe tener entre 3 y 40 caracteres A-Z, 0-9 o _");
  }
  return { code, name: requireString(body, "name", 150), description: optionalString(body, "description", 1000) };
};

export const parsePlanPatch = (raw: unknown): PlanPatchInput => {
  const body = asBody(raw);
  const patch: PlanPatchInput = {};
  if ("name" in body) patch.name = requireString(body, "name", 150);
  if ("description" in body) patch.description = optionalString(body, "description", 1000);
  if (body.status !== undefined) {
    if (String(body.status).toUpperCase() !== "RETIRED") {
      throw badRequest("CONTROL_CENTER_INVALID_FIELD", "Solo se permite status RETIRED");
    }
    patch.retire = true;
    patch.reason = requireReason(body);
  }
  if (Object.keys(patch).length === 0) throw badRequest("CONTROL_CENTER_EMPTY_PATCH", "No hay cambios para aplicar");
  return patch;
};

export const parsePriceVersion = (raw: unknown): PriceVersionInput => {
  const body = asBody(raw);
  if (!Array.isArray(body.components) || body.components.length === 0) {
    throw badRequest("CONTROL_CENTER_REQUIRED_FIELD", "components debe incluir al menos un componente de precio");
  }
  const seen = new Set<string>();
  const components = body.components.map((entry, index) => {
    const item = asBody(entry);
    const component = String(item.component ?? "").toUpperCase() as PriceComponentCode;
    const billingFrequency = String(item.billingFrequency ?? "").toUpperCase() as PriceComponent["billingFrequency"];
    if (!PRICE_COMPONENTS.includes(component)) {
      throw badRequest("CONTROL_CENTER_INVALID_FIELD", `components[${index}].component inválido`);
    }
    if (!(BILLING_FREQUENCIES as readonly string[]).includes(billingFrequency)) {
      throw badRequest("CONTROL_CENTER_INVALID_FIELD", `components[${index}].billingFrequency inválido`);
    }
    const key = `${component}:${billingFrequency}`;
    if (seen.has(key)) throw badRequest("CONTROL_CENTER_DUPLICATE_COMPONENT", `Componente duplicado: ${key}`);
    seen.add(key);
    return { component, billingFrequency, amount: parseMoney(item.amount, `components[${index}].amount`) };
  });
  if (!components.some((c) => c.component === "BASE_INITIAL_TERM")) {
    throw badRequest("CONTROL_CENTER_REQUIRED_FIELD", "La versión debe definir BASE_INITIAL_TERM");
  }
  return {
    validFrom: parseIsoDate(body.validFrom, "validFrom"),
    taxId: requireUuid(body, "taxId"),
    pricesIncludeTax: optionalBoolean(body, "pricesIncludeTax"),
    includedPosTerminals: requireInteger(body, "includedPosTerminals", 0, 1000),
    initialTermMonths: optionalInteger(body, "initialTermMonths", 1, 60) ?? 12,
    defaultTrialMonths: optionalInteger(body, "defaultTrialMonths", 0, 12) ?? 1,
    components,
    reason: requireReason(body),
  };
};
