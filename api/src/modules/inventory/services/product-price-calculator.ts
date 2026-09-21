export type ProductPriceTaxInput = {
  rate: number;
  calculationMethodCode?: string | null;
  isIncluded: boolean;
};

export type ProductPriceCalculation = {
  priceWithTax: number;
  priceWithoutTax: number;
};

const roundCurrency = (value: number) =>
  Math.round((value + 1e-9) * 100) / 100;

/** Derive percentage-tax prices. Special taxes remain with the pricing engine. */
export const calculateProductPrices = (
  finalPrice: number,
  taxes: ProductPriceTaxInput[]
): ProductPriceCalculation => {
  const percentageTax = taxes.find(
    (tax) =>
      !tax.calculationMethodCode || tax.calculationMethodCode === "PERCENTAGE"
  );
  const rate = percentageTax?.rate ?? 0;

  return {
    priceWithTax: roundCurrency(finalPrice),
    priceWithoutTax:
      percentageTax?.isIncluded && rate > 0
        ? roundCurrency(finalPrice / (1 + rate))
        : roundCurrency(finalPrice),
  };
};
