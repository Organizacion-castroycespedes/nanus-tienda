/**
 * Controlled values currently evidenced by the Manus fiscal domain and tests.
 * UNKNOWN is a persisted review state, never an editor option.
 */
export const FISCAL_PERSON_TYPE_OPTIONS = ["NATURAL", "JURIDICA"] as const;
export const FISCAL_TAX_REGIME_OPTIONS = [
  "ORDINARIO",
  "NO_RESPONSABLE",
  "SIMPLE",
  "ESPECIAL",
] as const;
export const FISCAL_RESPONSIBILITY_OPTIONS = [
  "R-99-PN",
  "O-13",
  "O-15",
  "O-23",
  "O-47",
] as const;

export type SupportedTaxRegime = (typeof FISCAL_TAX_REGIME_OPTIONS)[number];

export const isSupportedTaxRegime = (value: string) =>
  (FISCAL_TAX_REGIME_OPTIONS as readonly string[]).includes(value);

export const isSupportedFiscalResponsibility = (value: string) =>
  (FISCAL_RESPONSIBILITY_OPTIONS as readonly string[]).includes(value);

const FISCAL_PROFILE_FIELD_LABELS: Record<string, string> = {
  personType: "tipo de persona",
  taxRegime: "régimen tributario",
  taxResponsibilities: "responsabilidad fiscal",
  location: "ubicación",
};

export const formatFiscalProfileIncompleteMessage = (fields: string[]) => {
  const labels = fields.map((field) => FISCAL_PROFILE_FIELD_LABELS[field] ?? field);
  return `Completa los datos fiscales requeridos: ${labels.join(", ")}.`;
};

export const formatUnsupportedFiscalValueMessage = (
  kind: "regime" | "responsibility",
  value: string,
) => {
  const label = kind === "regime" ? "régimen tributario" : "responsabilidad fiscal";
  return `El valor "${value}" no es válido para ${label}. Selecciona una opción disponible.`;
};
