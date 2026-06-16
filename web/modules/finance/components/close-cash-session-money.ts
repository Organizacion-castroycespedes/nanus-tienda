const MAX_DECIMAL_DIGITS = 2;

export const sanitizeCashAmountInput = (rawValue: string) => {
  const normalized = rawValue.replace(/[$\s]/g, "").replace(/,/g, ".");
  const [integerPart = "", ...decimalParts] = normalized.split(".");
  const digits = integerPart.replace(/\D/g, "");
  const decimalDigits = decimalParts.join("").replace(/\D/g, "");

  if (decimalParts.length === 0) {
    return digits;
  }

  return `${digits}.${decimalDigits.slice(0, MAX_DECIMAL_DIGITS)}`;
};

export const parseCashAmountInput = (rawValue: string) => {
  const sanitized = sanitizeCashAmountInput(rawValue);
  if (!sanitized || sanitized === ".") {
    return 0;
  }

  const parsed = Number(sanitized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Number(parsed.toFixed(MAX_DECIMAL_DIGITS));
};

export const formatCashAmountForInput = (value: number) => {
  if (!Number.isFinite(value) || value < 0) {
    return "0";
  }

  return String(Number(value.toFixed(MAX_DECIMAL_DIGITS)));
};
