export const VAT_RESPONSIBILITY_VALUES = [
  "RESPONSIBLE",
  "NOT_RESPONSIBLE",
  "UNKNOWN",
] as const;

export type VatResponsibility = (typeof VAT_RESPONSIBILITY_VALUES)[number];

export const isVatResponsibility = (value: unknown): value is VatResponsibility =>
  typeof value === "string" &&
  (VAT_RESPONSIBILITY_VALUES as readonly string[]).includes(value);

export const normalizeVatResponsibility = (value: unknown): VatResponsibility => {
  if (isVatResponsibility(value)) return value;
  throw new Error(
    "vatResponsibility must be RESPONSIBLE, NOT_RESPONSIBLE, or UNKNOWN",
  );
};
