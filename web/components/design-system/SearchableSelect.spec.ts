import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  filterSearchableOptions,
  getNextActiveIndex,
  normalizeSearchText,
  type SearchableSelectOption,
} from "./SearchableSelect";

const options: SearchableSelectOption[] = [
  { value: "1", label: "Ron Medellín 750 ml", description: "RON001" },
  { value: "2", label: "Aguardiente Antioqueño", description: "AGUADIENTE003" },
  { value: "3", label: "Cerveza Club Colombia", description: "CER010", keywords: ["lager"] },
  { value: "4", label: "Vino tinto aguardentoso", description: "VIN002" },
];

test("normaliza mayúsculas y tildes", () => {
  assert.equal(normalizeSearchText("  MedELLÍN  "), "medellin");
});

test("sin consulta devuelve las opciones en orden, limitadas", () => {
  assert.deepEqual(
    filterSearchableOptions(options, "  ", 2).map((option) => option.value),
    ["1", "2"]
  );
});

test("busca por SKU, sin tildes y por palabras clave", () => {
  assert.deepEqual(filterSearchableOptions(options, "aguadiente003").map((o) => o.value), ["2"]);
  assert.deepEqual(filterSearchableOptions(options, "medellin").map((o) => o.value), ["1"]);
  assert.deepEqual(filterSearchableOptions(options, "LAGER").map((o) => o.value), ["3"]);
});

test("exige todas las palabras en cualquier orden", () => {
  assert.deepEqual(filterSearchableOptions(options, "750 ron").map((o) => o.value), ["1"]);
  assert.deepEqual(filterSearchableOptions(options, "ron cerveza"), []);
});

test("prioriza coincidencias al inicio de la etiqueta", () => {
  assert.deepEqual(filterSearchableOptions(options, "agua").map((o) => o.value), ["2", "4"]);
  assert.deepEqual(filterSearchableOptions(options, "aguardento").map((o) => o.value), ["4"]);
});

test("navegación por teclado acotada", () => {
  assert.equal(getNextActiveIndex("ArrowDown", -1, 3), 0);
  assert.equal(getNextActiveIndex("ArrowDown", 2, 3), 2);
  assert.equal(getNextActiveIndex("ArrowUp", -1, 3), 2);
  assert.equal(getNextActiveIndex("ArrowUp", 0, 3), 0);
  assert.equal(getNextActiveIndex("Home", 2, 3), 0);
  assert.equal(getNextActiveIndex("End", 0, 3), 2);
  assert.equal(getNextActiveIndex("ArrowDown", 0, 0), -1);
});

test("contrato accesible del componente", () => {
  const source = readFileSync(resolve(process.cwd(), "components/design-system/SearchableSelect.tsx"), "utf8");
  for (const fragment of [
    'role="combobox"',
    'role="listbox"',
    'role="option"',
    "aria-activedescendant",
    "aria-expanded",
    'aria-haspopup="listbox"',
  ]) {
    assert.ok(source.includes(fragment), `falta ${fragment}`);
  }
});
