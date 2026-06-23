export type DeliverySourceKind = "manual" | "order" | "sale";

export type DeliveryTotalsInput = {
  source: DeliverySourceKind;
  sourceSubtotal?: number | string | null;
  deliveryFee?: number | string | null;
};

export type DeliveryTotals = {
  sourceSubtotal: number;
  deliveryFee: number;
  total: number;
  hasNegativeDeliveryFee: boolean;
};

const toMoneyNumber = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const roundMoney = (value: number) => Math.round((value + 1e-9) * 100) / 100;

export const formatMoneyInput = (value?: number | string | null) =>
  String(roundMoney(toMoneyNumber(value)).toFixed(2));

export const calculateDeliveryTotals = ({
  source,
  sourceSubtotal,
  deliveryFee,
}: DeliveryTotalsInput): DeliveryTotals => {
  const normalizedSourceSubtotal =
    source === "manual" ? 0 : Math.max(0, toMoneyNumber(sourceSubtotal));
  const rawDeliveryFee = toMoneyNumber(deliveryFee);
  const hasNegativeDeliveryFee = rawDeliveryFee < 0;
  const normalizedDeliveryFee = hasNegativeDeliveryFee
    ? 0
    : Math.max(0, rawDeliveryFee);

  return {
    sourceSubtotal: roundMoney(normalizedSourceSubtotal),
    deliveryFee: roundMoney(normalizedDeliveryFee),
    total: roundMoney(normalizedSourceSubtotal + normalizedDeliveryFee),
    hasNegativeDeliveryFee,
  };
};
