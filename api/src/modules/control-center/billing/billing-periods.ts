import type { ItemFrequency, ItemType } from "../contracts/contract-items";
import { addDays, anchoredAddMonths, daysInclusive, maxDate, minDate } from "../shared/dates";
import { fromCents, lineTotalCents, rateToBasisPoints, roundToPesos, taxBreakdown, toCents } from "../shared/money";

export type ChargeKind = "PERIOD" | "PRORATION" | "ONE_TIME";
export type PeriodFrequency = "MONTHLY" | "ANNUAL";

export const PERIOD_MONTHS: Record<PeriodFrequency, number> = { MONTHLY: 1, ANNUAL: 12 };
const MAX_PERIODS = 1200;

export type BillableItem = {
  id: string;
  itemType: ItemType;
  description: string;
  quantity: string;
  unitAmount: string;
  discountAmount: string;
  billingFrequency: ItemFrequency;
};

export type BillableVersion = {
  id: string;
  versionNo: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  billingAnchorDay: number;
  trialEndsOn: string | null;
  prorationPolicy: "NONE" | "DAILY";
  taxName: string;
  taxRate: string;
  pricesIncludeTax: boolean;
  items: BillableItem[];
};

export type BillableContract = {
  id: string;
  startDate: string;
  endDate: string | null;
  versions: BillableVersion[];
};

export type PlannedLine = {
  contractItemId: string | null;
  itemType: ItemType;
  description: string;
  quantity: string;
  unitAmount: string;
  discountAmount: string;
  prorationFactor: string | null;
  lineTotal: string;
};

export type ChargeAmounts = {
  subtotal: string;
  discountTotal: string;
  base: string;
  tax: string;
  total: string;
};

export type PlannedCharge = {
  kind: ChargeKind;
  billingFrequency: ItemFrequency;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  version: BillableVersion;
  lines: PlannedLine[];
  amounts: ChargeAmounts;
};

const byVersionNo = (a: BillableVersion, b: BillableVersion) => a.versionNo - b.versionNo;

/** La facturación inicia al terminar la prueba; sin prueba, en el inicio del contrato. */
export const billingStartOf = (contract: BillableContract): string => {
  const first = [...contract.versions].sort(byVersionNo)[0];
  return first?.trialEndsOn ?? contract.startDate;
};

export const anchorDayOf = (contract: BillableContract): number =>
  [...contract.versions].sort(byVersionNo)[0]?.billingAnchorDay ?? Number(contract.startDate.slice(8, 10));

/** Versión vigente en una fecha (la de mayor número si hubiera solapamiento). */
export const versionAt = (contract: BillableContract, date: string): BillableVersion | null =>
  [...contract.versions]
    .sort(byVersionNo)
    .reverse()
    .find((v) => v.effectiveFrom <= date && (v.effectiveTo === null || v.effectiveTo >= date)) ?? null;

export const periodBounds = (billingStart: string, anchorDay: number, frequency: PeriodFrequency, index: number) => {
  const months = PERIOD_MONTHS[frequency];
  const start = index === 0 ? billingStart : anchoredAddMonths(billingStart, index * months, anchorDay);
  const end = addDays(anchoredAddMonths(billingStart, (index + 1) * months, anchorDay), -1);
  return { start, end };
};

/** Período de la frecuencia que contiene la fecha, o null si la fecha es anterior al inicio de facturación. */
export const periodContaining = (contract: BillableContract, frequency: PeriodFrequency, date: string) => {
  const billingStart = billingStartOf(contract);
  if (date < billingStart) return null;
  const anchorDay = anchorDayOf(contract);
  for (let index = 0; index < MAX_PERIODS; index += 1) {
    const bounds = periodBounds(billingStart, anchorDay, frequency, index);
    if (bounds.start <= date && date <= bounds.end) return { ...bounds, index };
    if (bounds.start > date) return null;
  }
  return null;
};

const itemLine = (item: BillableItem): PlannedLine => ({
  contractItemId: item.id,
  itemType: item.itemType,
  description: item.description,
  quantity: String(item.quantity),
  unitAmount: String(item.unitAmount),
  discountAmount: String(item.discountAmount),
  prorationFactor: null,
  lineTotal: fromCents(lineTotalCents(String(item.quantity), String(item.unitAmount), String(item.discountAmount))),
});

const signedCents = (value: string) => (value.startsWith("-") ? -toCents(value.slice(1)) : toCents(value));

/** Totales del cargo. El neto se redondea a pesos antes de calcular el impuesto. */
export const chargeAmounts = (lines: PlannedLine[], taxRate: string, pricesIncludeTax: boolean): ChargeAmounts => {
  let subtotal = 0n;
  let discount = 0n;
  let net = 0n;
  for (const line of lines) {
    const lineNet = signedCents(line.lineTotal);
    net += lineNet;
    if (line.prorationFactor === null) {
      subtotal += lineNet + toCents(line.discountAmount);
      discount += toCents(line.discountAmount);
    } else {
      subtotal += lineNet;
    }
  }
  const rounded = roundToPesos(net < 0n ? 0n : net);
  const breakdown = taxBreakdown(rounded, rateToBasisPoints(taxRate), pricesIncludeTax);
  return {
    subtotal: fromCents(subtotal < 0n ? 0n : subtotal),
    discountTotal: fromCents(discount),
    base: fromCents(breakdown.baseCents),
    tax: fromCents(breakdown.taxCents),
    total: fromCents(breakdown.totalCents),
  };
};

const buildCharge = (
  kind: ChargeKind,
  frequency: ItemFrequency,
  start: string,
  end: string,
  version: BillableVersion,
): PlannedCharge | null => {
  const items = version.items.filter((item) => item.billingFrequency === frequency);
  if (items.length === 0) return null;
  const lines = items.map(itemLine);
  return {
    kind,
    billingFrequency: frequency,
    periodStart: start,
    periodEnd: end,
    dueDate: start,
    version,
    lines,
    amounts: chargeAmounts(lines, version.taxRate, version.pricesIncludeTax),
  };
};

/**
 * Cargos que corresponden al contrato con inicio hasta `horizon` (y hasta la
 * terminación). Cada período toma la versión vigente en su inicio. Los ítems
 * de pago único se cobran una vez por versión, al inicio de su vigencia o de
 * la facturación, lo que ocurra después.
 */
export const planCharges = (contract: BillableContract, horizon: string): PlannedCharge[] => {
  const billingStart = billingStartOf(contract);
  const anchorDay = anchorDayOf(contract);
  const limit = contract.endDate ? minDate(horizon, contract.endDate) : horizon;
  if (limit < billingStart) return [];
  const planned: PlannedCharge[] = [];

  for (const frequency of ["MONTHLY", "ANNUAL"] as const) {
    for (let index = 0; index < MAX_PERIODS; index += 1) {
      const { start, end } = periodBounds(billingStart, anchorDay, frequency, index);
      if (start > limit) break;
      const version = versionAt(contract, start);
      if (!version) continue;
      const charge = buildCharge("PERIOD", frequency, start, end, version);
      if (charge) planned.push(charge);
    }
  }

  for (const version of [...contract.versions].sort(byVersionNo)) {
    const start = maxDate(version.effectiveFrom, billingStart);
    if (start > limit) continue;
    if (version.effectiveTo !== null && version.effectiveTo < start) continue;
    const charge = buildCharge("ONE_TIME", "ONE_TIME", start, start, version);
    if (charge) planned.push(charge);
  }

  return planned.sort((a, b) => (a.periodStart === b.periodStart ? a.billingFrequency.localeCompare(b.billingFrequency) : a.periodStart.localeCompare(b.periodStart)));
};

const TYPE_LABELS: Record<ItemType, string> = {
  BASE: "plan",
  EXTRA_POS_TERMINAL: "terminales POS adicionales",
  CERTIFICATION: "certificado DIAN",
  CUSTOM: "ítems adicionales",
};

const netByType = (version: BillableVersion, frequency: PeriodFrequency) => {
  const totals = new Map<ItemType, bigint>();
  for (const item of version.items) {
    if (item.billingFrequency !== frequency) continue;
    const net = lineTotalCents(String(item.quantity), String(item.unitAmount), String(item.discountAmount));
    totals.set(item.itemType, (totals.get(item.itemType) ?? 0n) + net);
  }
  return totals;
};

const signedRoundDiv = (numerator: bigint, denominator: bigint) => {
  const negative = numerator < 0n;
  const abs = negative ? -numerator : numerator;
  const result = (abs * 2n + denominator) / (denominator * 2n);
  return negative ? -result : result;
};

const formatFactor = (remaining: number, total: number) => {
  const micro = signedRoundDiv(BigInt(remaining) * 1_000_000n, BigInt(total));
  return `${micro / 1_000_000n}.${String(micro % 1_000_000n).padStart(6, "0")}`;
};

export type ProrationResult = {
  frequency: PeriodFrequency;
  periodStart: string;
  periodEnd: string;
  remainingDays: number;
  totalDays: number;
  factor: string;
  /** Diferencia del valor del período completo, en centavos (con signo). */
  deltaCents: bigint;
  /** Diferencia proporcional redondeada a pesos, en centavos (con signo). */
  proratedCents: bigint;
  lines: PlannedLine[];
};

/**
 * Prorrateo diario de una enmienda para una frecuencia: (valor nuevo − valor
 * anterior) × días restantes / días del período, redondeado a pesos. No hay
 * prorrateo si la enmienda rige al inicio de un período, antes de la
 * facturación o si el valor no cambia.
 */
export const computeProration = (
  contract: BillableContract,
  previous: BillableVersion,
  next: BillableVersion,
  effectiveFrom: string,
  frequency: PeriodFrequency,
): ProrationResult | null => {
  const period = periodContaining(contract, frequency, effectiveFrom);
  if (!period || period.start === effectiveFrom) return null;
  const before = netByType(previous, frequency);
  const after = netByType(next, frequency);
  const types = [...new Set([...before.keys(), ...after.keys()])].sort();
  const remainingDays = daysInclusive(effectiveFrom, period.end);
  const totalDays = daysInclusive(period.start, period.end);
  const factor = formatFactor(remainingDays, totalDays);
  let deltaCents = 0n;
  const lines: PlannedLine[] = [];
  for (const type of types) {
    const delta = (after.get(type) ?? 0n) - (before.get(type) ?? 0n);
    if (delta === 0n) continue;
    deltaCents += delta;
    const prorated = signedRoundDiv(delta * BigInt(remainingDays), BigInt(totalDays));
    lines.push({
      contractItemId: null,
      itemType: type,
      description: `Ajuste prorrateado de ${TYPE_LABELS[type]} (${remainingDays}/${totalDays} días)`,
      quantity: "1.00",
      unitAmount: fromCents(delta < 0n ? -delta : delta),
      discountAmount: "0.00",
      prorationFactor: factor,
      lineTotal: fromCents(prorated),
    });
  }
  if (deltaCents === 0n) return null;
  const exact = signedRoundDiv(deltaCents * BigInt(remainingDays), BigInt(totalDays));
  const proratedCents = exact < 0n ? -roundToPesos(-exact) : roundToPesos(exact);
  if (proratedCents === 0n) return null;
  return {
    frequency,
    periodStart: effectiveFrom,
    periodEnd: period.end,
    remainingDays,
    totalDays,
    factor,
    deltaCents,
    proratedCents,
    lines,
  };
};

/** Totales de un cargo de prorrateo positivo: se toma el total redondeado como monto con impuesto según la versión. */
export const prorationAmounts = (result: ProrationResult, version: BillableVersion): ChargeAmounts => {
  const breakdown = taxBreakdown(result.proratedCents, rateToBasisPoints(version.taxRate), version.pricesIncludeTax);
  return {
    subtotal: fromCents(result.proratedCents),
    discountTotal: "0.00",
    base: fromCents(breakdown.baseCents),
    tax: fromCents(breakdown.taxCents),
    total: fromCents(breakdown.totalCents),
  };
};

/** Estado de un cargo según lo pagado. Un cargo de valor cero queda pagado. */
export const chargeStatusFor = (totalCents: bigint, paidCents: bigint): "OPEN" | "PARTIALLY_PAID" | "PAID" =>
  paidCents >= totalCents ? "PAID" : paidCents > 0n ? "PARTIALLY_PAID" : "OPEN";

export type OpenCharge = { id: string; balanceCents: bigint };

/** Reparte un valor entre cargos abiertos en el orden dado (del más antiguo al más nuevo). */
export const planAutoAllocation = (availableCents: bigint, charges: OpenCharge[]) => {
  const allocations: { chargeId: string; amountCents: bigint }[] = [];
  let remaining = availableCents;
  for (const charge of charges) {
    if (remaining <= 0n) break;
    if (charge.balanceCents <= 0n) continue;
    const amount = charge.balanceCents < remaining ? charge.balanceCents : remaining;
    allocations.push({ chargeId: charge.id, amountCents: amount });
    remaining -= amount;
  }
  return { allocations, unallocatedCents: remaining };
};

export const signedToCents = signedCents;
