const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:\.(\d+))?$/;

const incrementInteger = (value: string) => {
  const digits = value.split("");
  let index = digits.length - 1;
  while (index >= 0 && digits[index] === "9") {
    digits[index] = "0";
    index -= 1;
  }
  if (index < 0) return `1${digits.join("")}`;
  digits[index] = String(Number(digits[index]) + 1);
  return digits.join("");
};

const groupThousands = (value: string) =>
  value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const roundDecimalString = (value: string, fractionDigits: number) => {
  const match = value.trim().match(DECIMAL_PATTERN);
  if (!match) return null;

  const [, sign, integerPart, fractionPart = ""] = match;
  const paddedFraction = fractionPart.padEnd(fractionDigits + 1, "0");
  const keptFraction = paddedFraction.slice(0, fractionDigits);
  const shouldRound = Number(paddedFraction[fractionDigits] ?? "0") >= 5;
  const combined = `${integerPart}${keptFraction}`;
  const rounded = shouldRound ? incrementInteger(combined) : combined;
  const integerLength = rounded.length - fractionDigits;
  const integer = rounded.slice(0, integerLength) || "0";
  const fraction = rounded.slice(integerLength).padStart(fractionDigits, "0");

  return {
    sign,
    integer: groupThousands(integer),
    fraction,
  };
};

export const formatInventoryCurrency = (value: string | null | undefined) => {
  if (value === null || value === undefined || value.trim() === "") return null;
  const formatted = roundDecimalString(value, 2);
  if (!formatted) return null;
  return `COP ${formatted.sign}${formatted.integer},${formatted.fraction}`;
};

export const formatInventoryUnits = (value: string | null | undefined) => {
  if (value === null || value === undefined || value.trim() === "") return null;
  const formatted = roundDecimalString(value, 2);
  if (!formatted) return null;
  const fraction = formatted.fraction.replace(/0+$/, "");
  return `${formatted.sign}${formatted.integer}${fraction ? `,${fraction}` : ""}`;
};
