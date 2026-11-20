const currencyWhole = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const currencyCents = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const quantityFormat = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 });

/** Pesos sin decimales si el valor es entero; con centavos siempre dos cifras (igual que el PDF). */
export const formatQuotationMoney = (value: number | null | undefined) => {
  const amount = Math.round((Number(value) || 0) * 100) / 100;
  return Number.isInteger(amount) ? currencyWhole.format(amount) : currencyCents.format(amount);
};

export const formatQuotationQuantity = (value: number) => quantityFormat.format(Number(value) || 0);

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-12-04" -> "4 dic 2026" sin pasar por zona horaria. */
export const formatQuotationDate = (value: string | null | undefined) => {
  if (!value) {
    return "-";
  }
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) {
    return value;
  }
  return `${day} ${MONTHS[month - 1]} ${year}`;
};

/** Dias restantes de vigencia respecto a hoy en America/Bogota (negativo = vencida). */
export const daysUntil = (validUntil: string, now: Date = new Date()) => {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const toUtc = (date: string) => {
    const [year, month, day] = date.slice(0, 10).split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(validUntil) - toUtc(today)) / 86_400_000);
};
