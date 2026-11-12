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

/*
 * Entradas de recepción (HU-SCAN-001, F4). Una línea de compra puede recibirse
 * en varias entradas (una por lote); la suma no puede superar el pendiente.
 */

export type ReceiveEntryValue = {
  key: string;
  purchaseItemId: string;
  productId: string;
  quantity: string;
  lotCode: string;
  expirationDate: string;
  locationId: string;
  unitCost: string;
};

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => value / 100;

export const createReceiveEntry = (
  item: { id: string; productId: string; cost?: number | null },
  key: string
): ReceiveEntryValue => ({
  key,
  purchaseItemId: item.id,
  productId: item.productId,
  quantity: "",
  lotCode: "",
  expirationDate: "",
  locationId: "",
  unitCost: Number.isFinite(Number(item.cost)) && item.cost !== null && item.cost !== undefined ? String(item.cost) : "",
});

/** Suma de cantidades válidas por purchaseItemId. */
export const getPreparedQuantityByItem = (entries: readonly ReceiveEntryValue[]) => {
  const cents: Record<string, number> = {};
  for (const entry of entries) {
    const quantity = getReceiveQuantity(entry);
    if (quantity > 0) {
      cents[entry.purchaseItemId] = (cents[entry.purchaseItemId] ?? 0) + toCents(quantity);
    }
  }
  return Object.fromEntries(
    Object.entries(cents).map(([itemId, value]) => [itemId, fromCents(value)])
  ) as Record<string, number>;
};

/** Suma una cantidad escaneada a la última entrada (lote en curso) de la línea. */
export const addQuantityToReceiveItem = (
  entries: readonly ReceiveEntryValue[],
  purchaseItemId: string,
  quantity: number
): ReceiveEntryValue[] => {
  let lastIndex = -1;
  entries.forEach((entry, index) => {
    if (entry.purchaseItemId === purchaseItemId) {
      lastIndex = index;
    }
  });
  if (lastIndex === -1) {
    return [...entries];
  }
  return entries.map((entry, index) =>
    index === lastIndex
      ? {
          ...entry,
          quantity: String(fromCents(toCents(getReceiveQuantity(entry)) + toCents(quantity))),
        }
      : entry
  );
};

/** Agrega una entrada vacía (nuevo lote) después de la última entrada de la línea. */
export const splitReceiveItem = (
  entries: readonly ReceiveEntryValue[],
  purchaseItemId: string,
  key: string
): ReceiveEntryValue[] => {
  let lastIndex = -1;
  entries.forEach((entry, index) => {
    if (entry.purchaseItemId === purchaseItemId) {
      lastIndex = index;
    }
  });
  if (lastIndex === -1) {
    return [...entries];
  }
  const source = entries[lastIndex];
  const next = [...entries];
  next.splice(lastIndex + 1, 0, {
    ...source,
    key,
    quantity: "",
    lotCode: "",
    expirationDate: "",
  });
  return next;
};

/** Quita una entrada si su línea conserva al menos otra. */
export const removeReceiveEntry = (entries: readonly ReceiveEntryValue[], key: string) => {
  const target = entries.find((entry) => entry.key === key);
  if (!target) {
    return [...entries];
  }
  const siblings = entries.filter((entry) => entry.purchaseItemId === target.purchaseItemId);
  return siblings.length > 1 ? entries.filter((entry) => entry.key !== key) : [...entries];
};

/** purchaseItemIds cuya cantidad preparada supera el pendiente. */
export const getItemsExceedingPending = <T extends PurchaseReceiveLineInput>(
  items: readonly T[],
  entries: readonly ReceiveEntryValue[]
) => {
  const prepared = getPreparedQuantityByItem(entries);
  return items
    .filter((item) => toCents(prepared[item.id] ?? 0) > toCents(getPendingQuantity(item)))
    .map((item) => item.id);
};

/** purchaseItemIds con el mismo código de lote repetido entre sus entradas. */
export const getItemsWithDuplicateLots = (entries: readonly ReceiveEntryValue[]) => {
  const seen = new Map<string, Set<string>>();
  const duplicated = new Set<string>();
  for (const entry of entries) {
    const lot = entry.lotCode.trim().toUpperCase();
    if (!lot || getReceiveQuantity(entry) <= 0) {
      continue;
    }
    const lots = seen.get(entry.purchaseItemId) ?? new Set<string>();
    if (lots.has(lot)) {
      duplicated.add(entry.purchaseItemId);
    }
    lots.add(lot);
    seen.set(entry.purchaseItemId, lots);
  }
  return [...duplicated];
};

export const getReceivableEntries = (entries: readonly ReceiveEntryValue[]) =>
  entries.filter((entry) => getReceiveQuantity(entry) > 0);
