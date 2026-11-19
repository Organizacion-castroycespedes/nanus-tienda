export const ALERT_STAGES = ["UPCOMING", "DUE", "OVERDUE_1", "OVERDUE_7", "OVERDUE_15", "OVERDUE_30"] as const;
export type AlertStage = (typeof ALERT_STAGES)[number];

/** Umbral de cada etapa en días respecto al vencimiento (negativo = antes de vencer). */
export const STAGE_THRESHOLDS: Record<AlertStage, number> = {
  UPCOMING: -5,
  DUE: 0,
  OVERDUE_1: 1,
  OVERDUE_7: 7,
  OVERDUE_15: 15,
  OVERDUE_30: 30,
};

const toUtc = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

/** Días de `today` respecto al vencimiento: negativo antes, 0 el día, positivo en mora. */
export const daysFromDue = (dueDate: string, today: string) => Math.round((toUtc(today) - toUtc(dueDate)) / 86_400_000);

/** Etapa vigente: la de mayor umbral alcanzado, o null si faltan más de 5 días. */
export const stageFor = (days: number): AlertStage | null => {
  let current: AlertStage | null = null;
  for (const stage of ALERT_STAGES) {
    if (days >= STAGE_THRESHOLDS[stage]) current = stage;
  }
  return current;
};

/** Etapa para un recordatorio manual: la vigente o, si aún faltan más de 5 días, la de aviso previo. */
export const manualStageFor = (days: number): AlertStage => stageFor(days) ?? "UPCOMING";

export const MAX_EMAIL_ATTEMPTS = 3;
