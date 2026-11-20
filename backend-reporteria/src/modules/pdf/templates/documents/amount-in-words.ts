// Valor en letras para documentos comerciales en pesos colombianos.

const UNITS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const TEENS = [
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
];
const TWENTIES = [
  "veinte",
  "veintiuno",
  "veintidós",
  "veintitrés",
  "veinticuatro",
  "veinticinco",
  "veintiséis",
  "veintisiete",
  "veintiocho",
  "veintinueve",
];
const TENS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const HUNDREDS = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
];

/** 0..99. Con `apocope`, "uno" final pasa a "un" (veintiún, treinta y un). */
const belowHundred = (value: number, apocope: boolean): string => {
  if (value < 10) {
    return value === 1 && apocope ? "un" : UNITS[value];
  }
  if (value < 20) {
    return TEENS[value - 10];
  }
  if (value < 30) {
    return value === 21 && apocope ? "veintiún" : TWENTIES[value - 20];
  }
  const tens = Math.floor(value / 10);
  const unit = value % 10;
  if (unit === 0) {
    return TENS[tens];
  }
  return `${TENS[tens]} y ${belowHundred(unit, apocope)}`;
};

/** 0..999. */
const belowThousand = (value: number, apocope: boolean): string => {
  if (value === 100) {
    return "cien";
  }
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (hundreds === 0) {
    return belowHundred(rest, apocope);
  }
  return rest === 0 ? HUNDREDS[hundreds] : `${HUNDREDS[hundreds]} ${belowHundred(rest, apocope)}`;
};

/** 0..999.999. */
const belowMillion = (value: number, apocope: boolean): string => {
  const thousands = Math.floor(value / 1000);
  const rest = value % 1000;
  const parts: string[] = [];
  if (thousands === 1) {
    parts.push("mil");
  } else if (thousands > 1) {
    parts.push(`${belowThousand(thousands, true)} mil`);
  }
  if (rest > 0 || thousands === 0) {
    parts.push(belowThousand(rest, apocope));
  }
  return parts.join(" ");
};

/** Entero no negativo en palabras (hasta 999.999.999.999). */
export const integerToSpanishWords = (value: number, apocope = false): string => {
  if (!Number.isInteger(value) || value < 0 || value > 999_999_999_999) {
    throw new RangeError("valor fuera de rango para letras");
  }
  const millions = Math.floor(value / 1_000_000);
  const rest = value % 1_000_000;
  const parts: string[] = [];
  if (millions === 1) {
    parts.push("un millón");
  } else if (millions > 1) {
    parts.push(`${belowMillion(millions, true)} millones`);
  }
  if (rest > 0 || millions === 0) {
    parts.push(belowMillion(rest, apocope));
  }
  return parts.join(" ");
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * "Un millón de pesos m/cte.", "Ciento diecinueve mil pesos con 50/100 m/cte.".
 */
export const amountToPesosInWords = (amount: number): string => {
  const safe = Math.max(0, Math.round((Number(amount) || 0) * 100));
  const pesos = Math.floor(safe / 100);
  const cents = safe % 100;
  const words = integerToSpanishWords(pesos, true);
  const exactMillions = pesos >= 1_000_000 && pesos % 1_000_000 === 0;
  const currency = pesos === 1 ? "peso" : exactMillions ? "de pesos" : "pesos";
  const centsText = cents > 0 ? ` con ${String(cents).padStart(2, "0")}/100` : "";
  return `${capitalize(words)} ${currency}${centsText} m/cte.`;
};
