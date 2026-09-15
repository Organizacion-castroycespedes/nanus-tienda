/**
 * Controlled values currently evidenced by the Manus fiscal domain and tests.
 * UNKNOWN is a persisted review state, never an editor option.
 */
export const FISCAL_PERSON_TYPE_OPTIONS = ["NATURAL", "JURIDICA"] as const;
export const FISCAL_TAX_REGIME_OPTIONS = ["ORDINARIO"] as const;
export const FISCAL_RESPONSIBILITY_OPTIONS = ["R-99-PN", "O-13"] as const;

export type SupportedTaxRegime = (typeof FISCAL_TAX_REGIME_OPTIONS)[number];

export const isSupportedTaxRegime = (value: string) =>
  (FISCAL_TAX_REGIME_OPTIONS as readonly string[]).includes(value);

export const isSupportedFiscalResponsibility = (value: string) =>
  (FISCAL_RESPONSIBILITY_OPTIONS as readonly string[]).includes(value);
