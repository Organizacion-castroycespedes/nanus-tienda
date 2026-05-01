export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

export const isOptionalUuid = (value: string | null | undefined) =>
  value == null || value === "" || isUuid(value);

export const assertNonNegativeDecimal = (value: number, field: string) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number`);
  }
};

export const assertPositiveDecimal = (value: number, field: string) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive number`);
  }
};

export const assertOptionalLength = (
  value: string | null | undefined,
  field: string,
  maxLength: number
) => {
  if (value != null && value.trim().length > maxLength) {
    throw new Error(`${field} must be at most ${maxLength} characters`);
  }
};

export const normalizeOptionalText = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};
