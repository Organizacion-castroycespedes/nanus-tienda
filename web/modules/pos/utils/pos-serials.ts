import type { PosCartItem, PosCartSerial } from "../../../store/posCart";

/** Primer producto con serie cuyo número de series no coincide con la cantidad. */
export const findSerialCartIssue = (items: readonly PosCartItem[]) =>
  items.find(
    (item) =>
      item.requiresSerial === true &&
      item.saleMode !== "WEIGHT" &&
      (item.serials?.length ?? 0) !== item.quantity,
  ) ?? null;

/** serialIds para el payload de la venta; undefined en productos sin serie (payload igual que hoy). */
export const buildSaleLineSerialIds = (item: PosCartItem) =>
  item.requiresSerial === true ? (item.serials ?? []).map((serial) => serial.id) : undefined;

/** Etiqueta corta para la línea del carrito: "SERIE · UBICACIÓN". */
export const formatPosSerialLabel = (serial: PosCartSerial) =>
  serial.locationCode ? `${serial.serialNumber} · ${serial.locationCode}` : serial.serialNumber;

/** Alterna una serie en la selección respetando el máximo (stock disponible). */
export const togglePosSerial = (
  selected: readonly PosCartSerial[],
  serial: PosCartSerial,
  max: number,
): PosCartSerial[] => {
  if (selected.some((candidate) => candidate.id === serial.id)) {
    return selected.filter((candidate) => candidate.id !== serial.id);
  }
  if (selected.length >= max) {
    return [...selected];
  }
  return [...selected, serial];
};

export type PosSerialReservation = { id: string; accountName: string };

/**
 * Series del producto que ya están en el carrito de otra cuenta de este POS. No se
 * pueden elegir aquí (la otra caja o terminal la valida el API al cobrar).
 */
export const collectSerialsInOtherAccounts = (
  accounts: ReadonlyArray<{ id: string; name: string; items: readonly PosCartItem[] }>,
  activeAccountId: string,
  productId: string,
): PosSerialReservation[] =>
  accounts
    .filter((account) => account.id !== activeAccountId)
    .flatMap((account) =>
      account.items
        .filter((item) => item.productId === productId)
        .flatMap((item) => (item.serials ?? []).map((serial) => ({ id: serial.id, accountName: account.name }))),
    );

/** Busca una serie escaneada (coincidencia exacta, sin distinguir mayúsculas). */
export const findScannedSerial = (available: readonly PosCartSerial[], code: string) => {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return null;
  }
  return available.find((serial) => serial.serialNumber.toUpperCase() === normalized) ?? null;
};
