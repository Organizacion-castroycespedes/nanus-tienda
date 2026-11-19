import { unprocessable } from "../shared/errors";
import { fromCents, lineTotalCents, rateToBasisPoints, taxBreakdown, toCents } from "../shared/money";

export const BILLING_FREQUENCIES = ["MONTHLY", "ANNUAL"] as const;
export type BillingFrequency = (typeof BILLING_FREQUENCIES)[number];
export const TERM_PHASES = ["INITIAL", "RENEWAL"] as const;
export type TermPhase = (typeof TERM_PHASES)[number];
export const ITEM_FREQUENCIES = ["MONTHLY", "ANNUAL", "ONE_TIME"] as const;
export type ItemFrequency = (typeof ITEM_FREQUENCIES)[number];
export type PriceComponentCode = "BASE_INITIAL_TERM" | "BASE_RENEWAL" | "EXTRA_POS_TERMINAL" | "CERTIFICATION";
export type ItemType = "BASE" | "EXTRA_POS_TERMINAL" | "CERTIFICATION" | "CUSTOM";

export type PriceComponent = {
  component: PriceComponentCode;
  billingFrequency: BillingFrequency;
  amount: string;
};

export type CustomItemInput = {
  description: string;
  quantity: string;
  unitAmount: string;
  billingFrequency: ItemFrequency;
  discountAmount: string;
};

export type PriceOverride = { unitAmount?: string; discountAmount?: string };

export type BuildItemsOptions = {
  termPhase: TermPhase;
  billingFrequency: BillingFrequency;
  extraPosTerminals: number;
  customItems: CustomItemInput[];
  overrides?: Partial<Record<"BASE" | "EXTRA_POS_TERMINAL", PriceOverride>>;
};

export type ContractItemDraft = {
  itemType: ItemType;
  description: string;
  quantity: string;
  unitAmount: string;
  billingFrequency: ItemFrequency;
  discountAmount: string;
  metadata: Record<string, unknown>;
};

export const CERTIFICATION_BONUS = {
  INITIAL: "INCLUIDA_TERMINO_INICIAL",
  ANNUAL_RENEWAL: "FIDELIDAD_RENOVACION_ANUAL",
} as const;

const findComponent = (components: PriceComponent[], code: PriceComponentCode, frequency: BillingFrequency) =>
  components.find((c) => c.component === code && c.billingFrequency === frequency) ?? null;

const requireComponent = (components: PriceComponent[], code: PriceComponentCode, frequency: BillingFrequency) => {
  const found = findComponent(components, code, frequency);
  if (!found) {
    throw unprocessable(
      "CONTROL_CENTER_PRICE_COMPONENT_MISSING",
      `La versión de precio no define ${code} con frecuencia ${frequency}`,
    );
  }
  return found;
};

const frequencyLabel = (frequency: ItemFrequency) =>
  frequency === "MONTHLY" ? "mensual" : frequency === "ANNUAL" ? "anual" : "único";

/**
 * Construye los ítems de una versión de contrato copiando los montos del
 * catálogo vigente (snapshot). Aplica las reglas de la propuesta comercial:
 * certificación incluida en el término inicial y en la renovación anual.
 */
export const buildContractItems = (
  components: PriceComponent[],
  options: BuildItemsOptions,
): { items: ContractItemDraft[]; priceAdjusted: boolean } => {
  const items: ContractItemDraft[] = [];
  let priceAdjusted = false;

  const applyOverride = (draft: ContractItemDraft, key: "BASE" | "EXTRA_POS_TERMINAL") => {
    const override = options.overrides?.[key];
    if (!override) return draft;
    const next = { ...draft };
    if (override.unitAmount !== undefined && override.unitAmount !== draft.unitAmount) {
      next.metadata = { ...next.metadata, catalogUnitAmount: draft.unitAmount };
      next.unitAmount = override.unitAmount;
      priceAdjusted = true;
    }
    if (override.discountAmount !== undefined && override.discountAmount !== draft.discountAmount) {
      next.discountAmount = override.discountAmount;
      priceAdjusted = true;
    }
    return next;
  };

  const baseCode: PriceComponentCode = options.termPhase === "INITIAL" ? "BASE_INITIAL_TERM" : "BASE_RENEWAL";
  const base = requireComponent(components, baseCode, options.billingFrequency);
  items.push(
    applyOverride(
      {
        itemType: "BASE",
        description:
          options.termPhase === "INITIAL"
            ? `Plan MANUS POS, término inicial (${frequencyLabel(options.billingFrequency)})`
            : `Plan MANUS POS, renovación ${frequencyLabel(options.billingFrequency)}`,
        quantity: "1.00",
        unitAmount: base.amount,
        billingFrequency: options.billingFrequency,
        discountAmount: "0.00",
        metadata: { component: baseCode },
      },
      "BASE",
    ),
  );

  if (options.extraPosTerminals > 0) {
    const extra = requireComponent(components, "EXTRA_POS_TERMINAL", options.billingFrequency);
    items.push(
      applyOverride(
        {
          itemType: "EXTRA_POS_TERMINAL",
          description: `Terminal POS adicional (${frequencyLabel(options.billingFrequency)})`,
          quantity: `${options.extraPosTerminals}.00`,
          unitAmount: extra.amount,
          billingFrequency: options.billingFrequency,
          discountAmount: "0.00",
          metadata: { component: "EXTRA_POS_TERMINAL" },
        },
        "EXTRA_POS_TERMINAL",
      ),
    );
  }

  const certification = findComponent(components, "CERTIFICATION", "ANNUAL");
  if (certification) {
    const bonus =
      options.termPhase === "INITIAL"
        ? CERTIFICATION_BONUS.INITIAL
        : options.billingFrequency === "ANNUAL"
          ? CERTIFICATION_BONUS.ANNUAL_RENEWAL
          : null;
    items.push({
      itemType: "CERTIFICATION",
      description: bonus ? "Certificado de resolución DIAN (incluido)" : "Certificado de resolución DIAN",
      quantity: "1.00",
      unitAmount: certification.amount,
      billingFrequency: "ANNUAL",
      discountAmount: bonus ? certification.amount : "0.00",
      metadata: bonus ? { component: "CERTIFICATION", bonus } : { component: "CERTIFICATION" },
    });
  }

  for (const custom of options.customItems) {
    items.push({
      itemType: "CUSTOM",
      description: custom.description,
      quantity: custom.quantity,
      unitAmount: custom.unitAmount,
      billingFrequency: custom.billingFrequency,
      discountAmount: custom.discountAmount,
      metadata: {},
    });
  }

  for (const item of items) {
    if (lineTotalCents(item.quantity, item.unitAmount, item.discountAmount) < 0n) {
      throw unprocessable("CONTROL_CENTER_DISCOUNT_EXCEEDS_AMOUNT", `El descuento de "${item.description}" supera su valor`);
    }
  }

  return { items, priceAdjusted };
};

export type FrequencyTotals = { subtotal: string; tax: string; total: string; base: string };

/** Totales informativos por frecuencia (antes y después de impuesto). */
export const summarizeItems = (
  items: Pick<ContractItemDraft, "quantity" | "unitAmount" | "discountAmount" | "billingFrequency">[],
  taxRate: string | number,
  pricesIncludeTax: boolean,
): Partial<Record<ItemFrequency, FrequencyTotals>> => {
  const rate = rateToBasisPoints(taxRate);
  const grouped = new Map<ItemFrequency, bigint>();
  for (const item of items) {
    const line = lineTotalCents(String(item.quantity), String(item.unitAmount), String(item.discountAmount));
    grouped.set(item.billingFrequency, (grouped.get(item.billingFrequency) ?? 0n) + line);
  }
  const result: Partial<Record<ItemFrequency, FrequencyTotals>> = {};
  for (const [frequency, amount] of grouped) {
    const breakdown = taxBreakdown(amount, rate, pricesIncludeTax);
    result[frequency] = {
      subtotal: fromCents(amount),
      base: fromCents(breakdown.baseCents),
      tax: fromCents(breakdown.taxCents),
      total: fromCents(breakdown.totalCents),
    };
  }
  return result;
};

export const contractedPosTerminals = (
  includedPosTerminals: number,
  items: Pick<ContractItemDraft, "itemType" | "quantity">[],
) =>
  includedPosTerminals +
  items
    .filter((item) => item.itemType === "EXTRA_POS_TERMINAL")
    .reduce((sum, item) => sum + Number(toCents(String(item.quantity)) / 100n), 0);
