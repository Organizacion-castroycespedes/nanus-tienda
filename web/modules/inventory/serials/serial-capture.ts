/** Misma regla que V117 (chk_product_serials_format) y el API (product-serial.normalize.ts). */
export const SERIAL_NUMBER_PATTERN = /^[A-Z0-9._/-]{1,100}$/;
export const MAX_SERIALS_PER_REQUEST = 2000;

export const normalizeSerialNumber = (value: string) => value.trim().toUpperCase();

export const isValidSerialNumber = (normalized: string) => SERIAL_NUMBER_PATTERN.test(normalized);

const HEADER_NAMES = new Set(["SERIE", "SERIAL", "SERIES", "NUMERO DE SERIE", "NUMERO_SERIE", "SERIAL NUMBER"]);

const isSerialHeader = (value: string) =>
  HEADER_NAMES.has(
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ")
  );

/**
 * Texto pegado o escaneado: una serie por línea; si la línea trae separadores
 * (coma, punto y coma o tabulador) se toma la primera columna. Omite vacíos y encabezado.
 */
export const parseSerialText = (text: string): string[] => {
  const serials: string[] = [];
  text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .forEach((line, index) => {
      const firstCell = line.split(/[;,\t]/)[0]?.replace(/^"|"$/g, "").trim() ?? "";
      if (!firstCell || (index === 0 && isSerialHeader(firstCell))) {
        return;
      }
      serials.push(firstCell);
    });
  return serials;
};

export type AddSerialsResult = {
  serials: string[];
  added: string[];
  invalid: string[];
  duplicates: string[];
  overflow: string[];
};

/**
 * Agrega series a la lista de una línea: normaliza a mayúsculas, descarta formato
 * inválido, repetidas (en la lista o en otras líneas del mismo producto) y las que
 * superen la cantidad a recibir.
 */
export const addSerials = (
  current: string[],
  incoming: string[],
  limit: number,
  takenElsewhere: Iterable<string> = []
): AddSerialsResult => {
  const serials = [...current];
  const seen = new Set([...current, ...takenElsewhere]);
  const result: AddSerialsResult = { serials, added: [], invalid: [], duplicates: [], overflow: [] };
  const max = Math.min(Math.max(Math.floor(limit), 0), MAX_SERIALS_PER_REQUEST);

  for (const raw of incoming) {
    const serial = normalizeSerialNumber(raw);
    if (!serial) {
      continue;
    }
    if (!isValidSerialNumber(serial)) {
      result.invalid.push(raw.trim());
      continue;
    }
    if (seen.has(serial)) {
      result.duplicates.push(serial);
      continue;
    }
    if (serials.length >= max) {
      result.overflow.push(serial);
      continue;
    }
    seen.add(serial);
    serials.push(serial);
    result.added.push(serial);
  }

  return result;
};

export const removeSerial = (current: string[], serial: string) =>
  current.filter((candidate) => candidate !== serial);

/** Texto del contador de captura: "3 de 5 series". */
export const formatSerialProgress = (captured: number, expected: number) =>
  `${captured} de ${expected} ${expected === 1 ? "serie" : "series"}`;

/** Productos con serie se reciben por unidades enteras. */
export const isWholeSerialQuantity = (quantity: number) =>
  Number.isInteger(quantity) && quantity >= 0;
