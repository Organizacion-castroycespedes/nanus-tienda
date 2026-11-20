import assert from "node:assert/strict";
import test from "node:test";
import { amountToPesosInWords, integerToSpanishWords } from "./amount-in-words";

test("enteros basicos y casos especiales del espanol", () => {
  const cases: Array<[number, string]> = [
    [0, "cero"],
    [1, "uno"],
    [15, "quince"],
    [16, "dieciséis"],
    [21, "veintiuno"],
    [22, "veintidós"],
    [30, "treinta"],
    [31, "treinta y uno"],
    [100, "cien"],
    [101, "ciento uno"],
    [115, "ciento quince"],
    [500, "quinientos"],
    [999, "novecientos noventa y nueve"],
    [1000, "mil"],
    [1001, "mil uno"],
    [2000, "dos mil"],
    [21000, "veintiún mil"],
    [31000, "treinta y un mil"],
    [100000, "cien mil"],
    [119000, "ciento diecinueve mil"],
    [1_000_000, "un millón"],
    [1_200_000, "un millón doscientos mil"],
    [2_000_000, "dos millones"],
    [21_000_000, "veintiún millones"],
    [1_000_000_000, "mil millones"],
    [987_654_321, "novecientos ochenta y siete millones seiscientos cincuenta y cuatro mil trescientos veintiuno"],
  ];
  for (const [value, expected] of cases) {
    assert.equal(integerToSpanishWords(value), expected, String(value));
  }
});

test("valores en pesos con apocope, 'de' en millones exactos y centavos", () => {
  assert.equal(amountToPesosInWords(1), "Un peso m/cte.");
  assert.equal(amountToPesosInWords(21), "Veintiún pesos m/cte.");
  assert.equal(amountToPesosInWords(14101.5), "Catorce mil ciento un pesos con 50/100 m/cte.");
  assert.equal(amountToPesosInWords(1_000_000), "Un millón de pesos m/cte.");
  assert.equal(amountToPesosInWords(3_000_000), "Tres millones de pesos m/cte.");
  assert.equal(amountToPesosInWords(1_250_000), "Un millón doscientos cincuenta mil pesos m/cte.");
  assert.equal(amountToPesosInWords(0), "Cero pesos m/cte.");
  assert.equal(amountToPesosInWords(0.07), "Cero pesos con 07/100 m/cte.");
});

test("rechaza valores fuera de rango", () => {
  assert.throws(() => integerToSpanishWords(-1), RangeError);
  assert.throws(() => integerToSpanishWords(1.5), RangeError);
});
