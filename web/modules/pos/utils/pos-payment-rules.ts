import type { PaymentMethod } from "../../finance/types";

const normalize = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

/** POS business rule: reference is optional for every payment line. */
export const getRequiresReferenceForPos = (_method?: PaymentMethod | null): boolean => false;

/**
 * Show bank/wallet selector only when the payment method model requires it,
 * or when the method type is transfer / bank / QR / PSE.
 * Never infer solely from the display name.
 */
export const getRequiresFinancialInstitutionForPos = (
  method?: PaymentMethod | null
): boolean => {
  if (!method) return false;

  if (method.tipo === "CASH") return false;

  if (method.requiresFinancialInstitution === true) return true;

  const tipo = normalize(method.tipo);
  if (tipo === "BANK" || tipo === "TRANSFER" || tipo === "QR" || tipo === "PSE") {
    return true;
  }

  const code = normalize(method.codigo);
  if (
    code.includes("TRANSFER") ||
    code.includes("QR") ||
    code.includes("PSE") ||
    code.includes("BREB")
  ) {
    return true;
  }

  return false;
};

/** Format raw numeric amount for display (es-CO currency style). */
export const formatPosAmountDisplay = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return trimmed;

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: Number.isInteger(parsed) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(parsed);
};

/**
 * Parse user input into a clean numeric string for storage.
 * Accepts both "199124.05" and "199.124,05" styles.
 */
export const parsePosAmountInput = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) return "";

  // Strip currency symbols and spaces
  let cleaned = trimmed.replace(/[$\s]/g, "");

  // Colombian format: thousands with "." and decimals with ","
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(",", ".");
  }

  cleaned = cleaned.replace(/[^0-9.]/g, "");

  // Keep only first decimal point
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    cleaned = `${parts[0]}.${parts.slice(1).join("")}`;
  }

  if (!cleaned || cleaned === ".") return "";

  const num = Number(cleaned);
  if (!Number.isFinite(num)) return "";

  // Store as clean numeric string without trailing zeros noise
  const rounded = Math.round(num * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};
