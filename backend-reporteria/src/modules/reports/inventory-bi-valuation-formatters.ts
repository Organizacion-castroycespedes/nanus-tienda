export const stockStatusLabel = (value: string) => ({
  all: "Todos",
  in_stock: "Con stock",
  with_stock: "Con stock",
  out_of_stock: "Agotado",
  negative: "Stock negativo",
}[value.trim().toLowerCase()] ?? value);

export const formatDecimal = (value: string, decimals: number, trimZeros = false) => {
  const normalized = value.trim();
  const negative = normalized.startsWith("-");
  const absolute = normalized.replace(/^[+-]/, "");
  const [integerPart, fractionPart = ""] = absolute.split(".");
  const scale = 10n ** BigInt(decimals);
  const magnitude = BigInt(integerPart || "0") * scale
    + BigInt((fractionPart + "0".repeat(decimals)).slice(0, decimals) || "0")
    + (fractionPart[decimals] && fractionPart[decimals] >= "5" ? 1n : 0n);
  const integer = (magnitude / scale).toString();
  let fraction = decimals ? (magnitude % scale).toString().padStart(decimals, "0") : "";
  if (trimZeros) fraction = fraction.replace(/0+$/, "");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${grouped}${fraction ? `,${fraction}` : ""}`;
};

export const formatMoney = (value: string) => `COP ${formatDecimal(value, 2)}`;
export const formatUnits = (value: string) => formatDecimal(value, 2, true);
export const formatPercent = (value: string | null) => value === null
  ? "No disponible" : `${formatDecimal(value, 2)}%`;

export const formatGeneratedAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota",
  }).format(date)} (COT)`;
};
