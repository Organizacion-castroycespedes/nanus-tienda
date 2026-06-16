export type PurchaseReceiveLineInput = {
  id: string;
  orderedQuantity: number;
  receivedQuantity: number;
};

export type ReceiveLineValueInput = {
  quantity?: string | number | null;
};

export type PurchaseReceiveRow<T extends PurchaseReceiveLineInput> = {
  item: T;
  index: number;
  pending: number;
};

export const toFiniteNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

export const getPendingQuantity = (item: PurchaseReceiveLineInput) =>
  Math.max(toFiniteNumber(item.orderedQuantity) - toFiniteNumber(item.receivedQuantity), 0);

export const getPendingReceiveRows = <T extends PurchaseReceiveLineInput>(
  items: T[]
): Array<PurchaseReceiveRow<T>> =>
  items
    .map((item, index) => ({
      item,
      index,
      pending: getPendingQuantity(item),
    }))
    .filter((row) => row.pending > 0);

export const getReceiveQuantity = (value: ReceiveLineValueInput | undefined) => {
  if (value?.quantity === "" || value?.quantity == null) {
    return 0;
  }

  return toFiniteNumber(value.quantity);
};

export const hasAnyPositiveReceiveQuantity = <T extends PurchaseReceiveLineInput>(
  rows: Array<PurchaseReceiveRow<T>>,
  values: ReceiveLineValueInput[]
) => rows.some((row) => getReceiveQuantity(values[row.index]) > 0);

export const getRowsWithReceivableQuantity = <T extends PurchaseReceiveLineInput>(
  rows: Array<PurchaseReceiveRow<T>>,
  values: ReceiveLineValueInput[]
) =>
  rows.filter((row) => {
    const quantity = getReceiveQuantity(values[row.index]);
    return quantity > 0 && quantity <= row.pending;
  });
