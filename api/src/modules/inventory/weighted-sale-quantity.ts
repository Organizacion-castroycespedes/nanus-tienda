const DECIMAL_VALUE = /^(?:0|[1-9]\d*)(?:\.(\d+))?$/;

/** Decimal half-up rounding for non-negative PostgreSQL NUMERIC wire values. */
export function roundCommercialWeightKg(rawWeightKg: string): string {
  const scale = 3;
  if (!DECIMAL_VALUE.test(rawWeightKg) || (rawWeightKg.split(".")[1]?.length ?? 0) > 6) {
    throw new Error("WEIGHT_VALUE_INVALID");
  }

  const [wholePart, fractionPart = ""] = rawWeightKg.split(".");
  const digits = fractionPart.padEnd(scale + 1, "0");
  const retained = digits.slice(0, scale) || "0";
  let scaled = BigInt(`${wholePart}${retained}`);
  if (digits.charAt(scale) >= "5") scaled += 1n;

  const divisor = 10n ** BigInt(scale);
  const whole = scaled / divisor;
  const fraction = (scaled % divisor).toString().padStart(scale, "0");
  return `${whole}.${fraction}`;
}
