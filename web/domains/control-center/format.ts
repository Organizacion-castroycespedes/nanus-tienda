import type {
  AlertStage,
  BillingFrequency,
  ChargeKind,
  ChargeStatus,
  ContractStatus,
  ReceiptStatus,
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
  CONTRACT_VOIDED: "Contrato anulado por error de registro",
  CHARGE_GENERATED: "Cargo generado",
  CHARGE_VOIDED: "Cargo anulado",
  BILLING_RUN_MANUAL: "Generación manual de cargos",
  PRORATION_CHARGED: "Cargo por prorrateo",
  PRORATION_CREDITED: "Crédito por prorrateo",
  RECEIPT_REGISTERED: "Pago registrado",
  RECEIPT_ALLOCATED: "Pago aplicado",
  RECEIPT_VOIDED: "Pago anulado",
  ALLOCATION_REVERSED: "Aplicación revertida",
  ALERTS_RUN_MANUAL: "Alertas ejecutadas manualmente",
  CHARGE_REMINDER_SENT: "Recordatorio enviado",
  ALERT_TEST_EMAIL_SENT: "Correo de prueba",
  ALERT_TEST_WHATSAPP_SENT: "WhatsApp de prueba",
  CONTRACT_PDF_DOWNLOADED: "PDF del contrato descargado",
  ACCOUNT_STATEMENT_DOWNLOADED: "Estado de cuenta descargado",
  ACCOUNT_STATEMENT_SENT: "Estado de cuenta enviado",
  REPORT_EXPORTED: "Reporte exportado",
};

export const MIN_REASON_LENGTH = 10;

export const isValidReason = (reason: string) => reason.trim().length >= MIN_REASON_LENGTH;

/** Genera una llave de idempotencia por intento de creación (se reutiliza en reintentos). */
export const newIdempotencyKey = () =>
  `contract-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Fase 2: cargos, recaudos y cartera -------------------------------------------

export const CHARGE_STATUS_LABELS: Record<ChargeStatus, string> = {
  OPEN: "Pendiente",
  PARTIALLY_PAID: "Abono parcial",
  PAID: "Pagado",
  VOID: "Anulado",
};

export const CHARGE_STATUS_TONES: Record<ChargeStatus, "warn" | "ok" | "muted" | "danger"> = {
  OPEN: "warn",
  PARTIALLY_PAID: "warn",
  PAID: "ok",
  VOID: "muted",
};

export const CHARGE_KIND_LABELS: Record<ChargeKind, string> = {
  PERIOD: "Período",
  PRORATION: "Prorrateo",
  ONE_TIME: "Pago único",
};

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  CONFIRMED: "Confirmado",
  VOID: "Anulado",
};

/** Monto decimal string ("850000.00", "-5.5") a centavos sin aritmética de punto flotante. */
export const moneyToCents = (value: string | null | undefined): bigint => {
  const raw = String(value ?? "0").trim() || "0";
  const negative = raw.startsWith("-");
  const [integer, fraction = ""] = (negative ? raw.slice(1) : raw).split(".");
  const cents = BigInt(integer || "0") * BigInt(100) + BigInt((fraction + "00").slice(0, 2));
  return negative ? -cents : cents;
};

export const centsToMoney = (cents: bigint): string => {
  const negative = cents < BigInt(0);
  const abs = negative ? -cents : cents;
  return `${negative ? "-" : ""}${abs / BigInt(100)}.${String(abs % BigInt(100)).padStart(2, "0")}`;
};

export const sumMoney = (values: (string | null | undefined)[]) =>
  centsToMoney(values.reduce((sum, value) => sum + moneyToCents(value), BigInt(0)));

/** Un cargo está vencido si tiene saldo y su vencimiento es anterior a la fecha de referencia. */
export const isOverdue = (charge: { status: ChargeStatus; dueDate: string }, today: string) =>
  (charge.status === "OPEN" || charge.status === "PARTIALLY_PAID") && charge.dueDate < today;

/** Fecha de hoy en Bogotá (UTC-5) en formato AAAA-MM-DD. */
export const todayInBogota = (now: Date = new Date()) => new Date(now.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);

export const newReceiptIdempotencyKey = () =>
  `receipt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const formatFileSize = (bytes: number | null | undefined) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const RECEIPT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";

// Fase 3: alertas de cobro -----------------------------------------------------

export const ALERT_STAGE_LABELS: Record<AlertStage, string> = {
  UPCOMING: "5 días antes",
  DUE: "Día del vencimiento",
  OVERDUE_1: "1 día de mora",
  OVERDUE_7: "7 días de mora",
  OVERDUE_15: "15 días de mora",
  OVERDUE_30: "30 días de mora",
};

export const ALERT_STATUS_LABELS: Record<"SENT" | "FAILED" | "SKIPPED", string> = {
  SENT: "Enviada",
  FAILED: "Fallida",
  SKIPPED: "Omitida",
};

// Reportes ---------------------------------------------------------------------

export const RENEWAL_EVENT_LABELS: Record<"TRIAL_END" | "INITIAL_TERM_END" | "ANNUAL_RENEWAL", string> = {
  TRIAL_END: "Fin de la prueba",
  INITIAL_TERM_END: "Fin del término inicial",
  ANNUAL_RENEWAL: "Renovación anual",
};

/** Descarga un Blob con el nombre indicado. */
export const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Fecha AAAA-MM-DD menos N meses (con ajuste a fin de mes) más un día: inicio por defecto del estado de cuenta. */
export const defaultStatementFrom = (to: string) => {
  const [y, m, d] = to.split("-").map(Number);
  const index = y * 12 + (m - 1) - 12;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const date = new Date(Date.UTC(year, month - 1, Math.min(d, last) + 1));
  return date.toISOString().slice(0, 10);
};

export const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
};
