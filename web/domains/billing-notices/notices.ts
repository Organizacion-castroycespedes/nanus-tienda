export type BillingNoticeStage = "UPCOMING" | "DUE" | "OVERDUE_1" | "OVERDUE_7" | "OVERDUE_15" | "OVERDUE_30";

export type BillingNotice = {
  id: string;
  chargeNumber: string;
  stage: BillingNoticeStage;
  dueDate: string;
  balance: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  updatedAt: string;
};

export const BILLING_NOTICE_ROLES = ["SUPER_ADMIN", "SUPER_USER", "ADMIN"];

export const canSeeBillingNotices = (role: string | null | undefined) =>
  BILLING_NOTICE_ROLES.includes(String(role ?? "").toUpperCase());

export type NoticeTone = "info" | "warning" | "danger";

export const noticeTone = (stage: BillingNoticeStage): NoticeTone =>
  stage === "UPCOMING" ? "info" : stage === "DUE" ? "warning" : "danger";

const toUtc = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

const formatDay = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

/** "850000.00" -> "$850.000" sin aritmética de punto flotante. */
export const formatNoticeAmount = (amount: string) => `$${amount.split(".")[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

/** Texto del aviso para el administrador del tenant cliente. */
export const noticeMessage = (notice: BillingNotice, today: string) => {
  const amount = formatNoticeAmount(notice.balance);
  const days = Math.round((toUtc(today) - toUtc(notice.dueDate)) / 86_400_000);
  if (days < 0) return `Tienes un pago pendiente con MANUS: cargo ${notice.chargeNumber} por ${amount}, vence el ${formatDay(notice.dueDate)}.`;
  if (days === 0) return `Tu pago con MANUS vence hoy: cargo ${notice.chargeNumber} por ${amount}.`;
  return `Tu pago con MANUS está vencido hace ${days === 1 ? "1 día" : `${days} días`}: cargo ${notice.chargeNumber} por ${amount}.`;
};

export const todayInBogota = (now: Date = new Date()) => new Date(now.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);

/** Clave de ocultamiento por sesión: cambia si cambian la etapa o el saldo. */
export const dismissKey = (notices: BillingNotice[]) =>
  `manus.billing-notices.dismissed:${notices.map((n) => `${n.id}:${n.stage}:${n.balance}`).join("|")}`;
