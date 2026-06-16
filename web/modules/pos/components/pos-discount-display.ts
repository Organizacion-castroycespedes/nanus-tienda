export type PosCartDiscountDisplayInput = {
  baseUnitPrice?: number | null;
  finalUnitPrice?: number | null;
  unitPrice?: number | null;
  quantity: number;
  discountAmount?: number | null;
  discountTotal?: number | null;
  discountPercent?: number | null;
  isWeighable: boolean;
};

export type PosCartDiscountDisplay = {
  unitDiscount: number;
  totalDiscount: number;
  percent: number | null;
  showLineTotal: boolean;
};

const roundMoney = (value: number) => Number(value.toFixed(2));

const isPositiveFinite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const isQuantityOne = (quantity: number) => Math.abs(quantity - 1) < 0.000001;

export const buildPosCartDiscountDisplay = (
  input: PosCartDiscountDisplayInput
): PosCartDiscountDisplay | null => {
  if (!isPositiveFinite(input.quantity)) {
    return null;
  }

  const finalUnitPrice = isPositiveFinite(input.finalUnitPrice)
    ? input.finalUnitPrice
    : input.unitPrice;
  const unitDiscountFromPrices =
    isPositiveFinite(input.baseUnitPrice) &&
    isPositiveFinite(finalUnitPrice) &&
    input.baseUnitPrice > finalUnitPrice
      ? roundMoney(input.baseUnitPrice - finalUnitPrice)
      : null;
  const unitDiscountFromPreview = isPositiveFinite(input.discountAmount)
    ? roundMoney(input.discountAmount)
    : null;
  const unitDiscount = unitDiscountFromPrices ?? unitDiscountFromPreview;

  if (!isPositiveFinite(unitDiscount)) {
    return null;
  }

  const totalDiscount = isPositiveFinite(input.discountTotal)
    ? roundMoney(input.discountTotal)
    : roundMoney(unitDiscount * input.quantity);

  if (!isPositiveFinite(totalDiscount)) {
    return null;
  }

  return {
    unitDiscount,
    totalDiscount,
    percent: isPositiveFinite(input.discountPercent)
      ? roundMoney(input.discountPercent)
      : null,
    showLineTotal: input.isWeighable || !isQuantityOne(input.quantity),
  };
};
