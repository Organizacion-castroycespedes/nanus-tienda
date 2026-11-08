import type {
  BillingFrequency,
  ContractStatus,
  ItemFrequency,
  PriceComponentCode,
  TermPhase,
} from "./types";

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formatea un monto decimal string ("850000.00") en COP sin usar float para el cálculo. */
export const formatCOP = (value: string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "—";
  const [integer] = String(value).split(".");
  const n = Number(integer);
  return Number.isFinite(n) ? copFormatter.format(n) : String(value);
};

/** Normaliza lo que escribe el usuario ("850.000", "$ 850000") a decimal string, o null si no es válido. */
export const normalizeMoneyInput = (raw: string): string | null => {
  const cleaned = raw.replace(/[$\s]/g, "").replace(/\./g, "").replace(",", ".");
  return /^\d{1,16}(\.\d{1,2})?$/.test(cleaned) ? cleaned : null;
};

/** Tasa fracción ("0.1900") a texto "19%". */
export const formatRate = (rate: string | null | undefined) => {
  if (!rate) return "—";
  const percent = Math.round(Number(rate) * 10000) / 100;
  return Number.isFinite(percent) ? `${percent}%` : rate;
};

export const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  ENDED: "Terminado",
  CANCELLED: "Cancelado",
};

export const CONTRACT_STATUS_STYLES: Record<ContractStatus, string> = {
  DRAFT: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300",
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300",
  ENDED: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700 dark:text-slate-300",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300",
};

export const FREQUENCY_LABELS: Record<ItemFrequency, string> = {
  MONTHLY: "Mensual",
  ANNUAL: "Anual",
  ONE_TIME: "Único",
};

export const TERM_PHASE_LABELS: Record<TermPhase, string> = {
  INITIAL: "Término inicial",
  RENEWAL: "Renovación",
};

export const COMPONENT_LABELS: Record<PriceComponentCode, string> = {
  BASE_INITIAL_TERM: "Plan, término inicial",
  BASE_RENEWAL: "Plan, renovación",
  EXTRA_POS_TERMINAL: "Terminal POS adicional",
  CERTIFICATION: "Certificado de resolución DIAN",
};

export const BILLING_FREQUENCY_OPTIONS: { value: BillingFrequency; label: string }[] = [
  { value: "ANNUAL", label: "Anual" },
  { value: "MONTHLY", label: "Mensual" },
];

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CONTRACT_CREATED: "Contrato creado",
  CONTRACT_PRICE_ADJUSTED: "Precio ajustado",
  CONTRACT_TRIAL_MODIFIED: "Prueba modificada",
  CONTRACT_ACTIVATED: "Contrato activado",
  CONTRACT_AMENDED: "Contrato enmendado",
  CONTRACT_ENDED: "Contrato terminado",
  CONTRACT_CANCELLED: "Contrato cancelado",
};

export const MIN_REASON_LENGTH = 10;

export const isValidReason = (reason: string) => reason.trim().length >= MIN_REASON_LENGTH;

/** Genera una llave de idempotencia por intento de creación (se reutiliza en reintentos). */
export const newIdempotencyKey = () =>
  `contract-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
