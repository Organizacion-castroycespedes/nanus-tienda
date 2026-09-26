const BUSINESS_TIME_ZONE = "America/Bogota";

export function todayInBusinessTimeZone(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
