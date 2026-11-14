/** Misma regla que V117 (chk_product_serials_format y fnc_product_serials_normalize). */
export const SERIAL_NUMBER_PATTERN = /^[A-Z0-9._/-]{1,100}$/;
export const MAX_SERIALS_PER_REQUEST = 2000;

export const normalizeSerialNumber = (value: unknown) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

export const isValidSerialNumber = (normalized: string) => SERIAL_NUMBER_PATTERN.test(normalized);

const HEADER_NAMES = new Set(["SERIE", "SERIAL", "SERIES", "NUMERO DE SERIE", "NUMERO_SERIE", "SERIAL NUMBER"]);

const stripAccents = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "");

export const isSerialHeader = (value: string) =>
  HEADER_NAMES.has(stripAccents(value).trim().toUpperCase().replace(/\s+/g, " "));

/**
 * Lee series desde texto pegado o un CSV: una serie por línea; si la línea tiene
 * separadores (coma, punto y coma o tabulador) se toma la primera columna.
 * Omite líneas vacías y un encabezado ("serie", "serial", "número de serie").
 */
export const parseSerialText = (text: string): string[] => {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const serials: string[] = [];
  lines.forEach((line, index) => {
    const firstCell = line.split(/[;,\t]/)[0]?.replace(/^"|"$/g, "").trim() ?? "";
    if (!firstCell) {
      return;
    }
    if (index === 0 && isSerialHeader(firstCell)) {
      return;
    }
    serials.push(firstCell);
  });
  return serials;
};
