// Same half-up cents rounding the billing mapper and FactuCore apply to
// percentage taxes, so the invoice rebuilds exactly this amount.
export const calculatePercentageTaxAmount = (taxBase: number, taxRate: number) => {
  const baseCents = BigInt(Math.round(taxBase * 100));
  const rateUnits = BigInt(Math.round(taxRate * 1_000_000));
  return Number((baseCents * rateUnits + 500_000n) / 1_000_000n) / 100;
};

// Line base such that base + tax(base) equals the charged net amount; some
// amounts are unreachable by one cent because the tax jumps two cents.
export const resolveLineTaxBase = (netLineAmount: number, taxRate: number) => {
  const targetCents = Math.round(netLineAmount * 100);
  if (taxRate <= 0) {
    return targetCents / 100;
  }

  const exactCents = targetCents / (1 + taxRate);
  const startCents = Math.round(exactCents);
  let bestCents = startCents;
  let bestGap = Number.POSITIVE_INFINITY;

  for (let offset = -2; offset <= 2; offset += 1) {
    const candidateCents = startCents + offset;
    const taxCents = Math.round(
      calculatePercentageTaxAmount(candidateCents / 100, taxRate) * 100
    );
    const gap = Math.abs(candidateCents + taxCents - targetCents);
    if (
      gap < bestGap ||
      (gap === bestGap &&
        Math.abs(candidateCents - exactCents) < Math.abs(bestCents - exactCents))
    ) {
      bestCents = candidateCents;
      bestGap = gap;
    }
  }

  return bestCents / 100;
};
