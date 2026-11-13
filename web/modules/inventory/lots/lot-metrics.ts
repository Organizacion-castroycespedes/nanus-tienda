/**
 * Indicadores de Inventario > Lotes con un único alcance
 * (change modernizar-inventario-lotes-ubicaciones, D5).
 */

export type LotMetricStatus =
  | "ACTIVE"
  | "EXPIRED"
  | "BLOCKED"
  | "CONSUMED"
  | "CANCELLED";

export type LotMetricRow = {
  lot: {
    id: string;
    status: LotMetricStatus;
    expirationDate: string | null;
  };
  balance: { quantityAvailable: number } | null;
};

export type LotMetrics = {
  activeLots: number;
  expiredLots: number;
  expiringLots: number;
  sellableAvailable: number;
  nonSellableAvailable: number;
  nonSellableBreakdown: {
    expired: number;
    blocked: number;
    other: number;
  };
};

export const EXPIRING_WINDOW_DAYS = 30;

const startOfDay = (value: Date) => {
  const date = new Date(value.getTime());
  date.setHours(0, 0, 0, 0);
  return date;
};

const toDateOnly = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** Días entre hoy y la fecha (negativo = vencido); `null` sin fecha. */
export const daysUntil = (
  value: string | null | undefined,
  today: Date = new Date()
) => {
  const target = toDateOnly(value);
  if (!target) {
    return null;
  }
  return Math.round(
    (target.getTime() - startOfDay(today).getTime()) / 86_400_000
  );
};

export const isLotExpired = (
  lot: LotMetricRow["lot"],
  today: Date = new Date()
) => {
  const days = daysUntil(lot.expirationDate, today);
  return lot.status === "EXPIRED" || (days !== null && days < 0);
};

export const isLotExpiring = (
  lot: LotMetricRow["lot"],
  today: Date = new Date()
) => {
  const days = daysUntil(lot.expirationDate, today);
  return (
    lot.status !== "EXPIRED" &&
    days !== null &&
    days >= 0 &&
    days <= EXPIRING_WINDOW_DAYS
  );
};

/** Misma regla que la venta: lote ACTIVE con vencimiento nulo o no anterior a hoy. */
export const isLotSellable = (
  lot: LotMetricRow["lot"],
  today: Date = new Date()
) => {
  if (lot.status !== "ACTIVE") {
    return false;
  }
  const days = daysUntil(lot.expirationDate, today);
  return days === null || days >= 0;
};

export const computeLotMetrics = (
  rows: readonly LotMetricRow[],
  today: Date = new Date()
): LotMetrics => {
  const lots = new Map<string, LotMetricRow["lot"]>();
  const metrics: LotMetrics = {
    activeLots: 0,
    expiredLots: 0,
    expiringLots: 0,
    sellableAvailable: 0,
    nonSellableAvailable: 0,
    nonSellableBreakdown: { expired: 0, blocked: 0, other: 0 },
  };

  rows.forEach((row) => {
    lots.set(row.lot.id, row.lot);
    const available = Number(row.balance?.quantityAvailable ?? 0);
    if (!(available > 0)) {
      return;
    }
    if (isLotSellable(row.lot, today)) {
      metrics.sellableAvailable += available;
      return;
    }
    metrics.nonSellableAvailable += available;
    if (isLotExpired(row.lot, today)) {
      metrics.nonSellableBreakdown.expired += available;
    } else if (row.lot.status === "BLOCKED") {
      metrics.nonSellableBreakdown.blocked += available;
    } else {
      metrics.nonSellableBreakdown.other += available;
    }
  });

  lots.forEach((lot) => {
    if (lot.status === "ACTIVE") {
      metrics.activeLots += 1;
    }
    if (isLotExpired(lot, today)) {
      metrics.expiredLots += 1;
    } else if (isLotExpiring(lot, today)) {
      metrics.expiringLots += 1;
    }
  });

  return metrics;
};
