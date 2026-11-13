import { anchoredAddMonths, daysInclusive } from "../shared/dates";
import { buildContractItems, summarizeItems, type PriceComponent } from "../contracts/contract-items";

export type RenewalEventType = "TRIAL_END" | "INITIAL_TERM_END" | "ANNUAL_RENEWAL";

export type RenewalVersion = {
  versionNo: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  termPhase: "INITIAL" | "RENEWAL";
  billingFrequency: "MONTHLY" | "ANNUAL";
  billingAnchorDay: number;
  trialEndsOn: string | null;
  initialTermMonths: number;
  taxRate: string;
  pricesIncludeTax: boolean;
  items: { itemType: string; quantity: string; unitAmount: string; discountAmount: string; billingFrequency: string }[];
};

export type RenewalContract = {
  id: string;
  contractNumber: string;
  startDate: string;
  accountLegalName: string;
  tenantName: string;
  versions: RenewalVersion[];
};

export type RenewalEvent = {
  type: RenewalEventType;
  date: string;
  daysRemaining: number;
  renewalRegistered: boolean;
  currentFrequency: "MONTHLY" | "ANNUAL";
  currentValue: string | null;
};

const sorted = (contract: RenewalContract) => [...contract.versions].sort((a, b) => a.versionNo - b.versionNo);

const currentVersion = (contract: RenewalContract, today: string) =>
  [...sorted(contract)].reverse().find((v) => v.effectiveFrom <= today && (v.effectiveTo === null || v.effectiveTo >= today)) ??
  sorted(contract).at(-1) ??
  null;

/** Eventos de vencimiento comercial de un contrato activo dentro de la ventana [hoy, hoy + días]. */
export const renewalEvents = (contract: RenewalContract, today: string, windowDays: number): RenewalEvent[] => {
  const versions = sorted(contract);
  const first = versions[0];
  const current = currentVersion(contract, today);
  if (!first || !current) return [];
  const limit = (() => {
    const [y, m, d] = today.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + windowDays));
    return date.toISOString().slice(0, 10);
  })();
  const inWindow = (date: string) => date >= today && date <= limit;
  const billingStart = first.trialEndsOn ?? contract.startDate;
  const anchor = first.billingAnchorDay;
  const totals = summarizeItems(current.items as any, current.taxRate, current.pricesIncludeTax);
  const currentValue = totals[current.billingFrequency]?.total ?? null;
  const registeredBy = (date: string) => versions.some((v) => v.versionNo > current.versionNo && v.effectiveFrom <= date);
  const base = (type: RenewalEventType, date: string): RenewalEvent => ({
    type,
    date,
    daysRemaining: daysInclusive(today, date) - 1,
    renewalRegistered: type !== "TRIAL_END" && registeredBy(date),
    currentFrequency: current.billingFrequency,
    currentValue,
  });
  const events: RenewalEvent[] = [];
  if (first.trialEndsOn && inWindow(first.trialEndsOn)) events.push(base("TRIAL_END", first.trialEndsOn));
  if (current.termPhase === "INITIAL") {
    const termEnd = anchoredAddMonths(billingStart, current.initialTermMonths, anchor);
    if (inWindow(termEnd)) events.push(base("INITIAL_TERM_END", termEnd));
  } else if (current.billingFrequency === "ANNUAL") {
    for (let index = 1; index <= 100; index += 1) {
      const next = anchoredAddMonths(billingStart, index * 12, anchor);
      if (next < today) continue;
      if (inWindow(next)) events.push(base("ANNUAL_RENEWAL", next));
      break;
    }
  }
  return events;
};

/**
 * Valores de renovación con el catálogo vigente y las mismas terminales adicionales:
 * total anual, total mensual y, en la renovación mensual, lo que se cobra aparte cada año (certificación).
 */
export const renewalValues = (
  components: PriceComponent[] | null,
  current: Pick<RenewalVersion, "items" | "taxRate" | "pricesIncludeTax">,
): { monthly: string | null; monthlyAnnualExtras: string | null; annual: string | null } => {
  if (!components) return { monthly: null, monthlyAnnualExtras: null, annual: null };
  const extras = current.items
    .filter((item) => item.itemType === "EXTRA_POS_TERMINAL")
    .reduce((sum, item) => sum + Math.round(Number(item.quantity)), 0);
  const totalsFor = (billingFrequency: "MONTHLY" | "ANNUAL") => {
    try {
      const { items } = buildContractItems(components, { termPhase: "RENEWAL", billingFrequency, extraPosTerminals: extras, customItems: [] });
      return summarizeItems(items, current.taxRate, current.pricesIncludeTax);
    } catch {
      return null;
    }
  };
  const annual = totalsFor("ANNUAL");
  const monthly = totalsFor("MONTHLY");
  const extrasTotal = monthly?.ANNUAL?.total ?? null;
  return {
    annual: annual?.ANNUAL?.total ?? null,
    monthly: monthly?.MONTHLY?.total ?? null,
    monthlyAnnualExtras: extrasTotal && extrasTotal !== "0.00" ? extrasTotal : null,
  };
};
