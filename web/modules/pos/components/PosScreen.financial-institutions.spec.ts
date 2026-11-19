import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "modules/pos/components/PosScreen.tsx"),
  "utf8"
);
const dialogSource = readFileSync(
  resolve(process.cwd(), "modules/pos/components/payment/PaymentDialog.tsx"),
  "utf8"
);

it("POS keeps the original unfiltered active financial institution catalog", () => {
  expect(source).toMatch(/listFinancialInstitutions\(\)\.catch\(\(\) => \[\]\)/);
  expect(source).toMatch(/banks\.filter\(\(b\) => b\.active\)/);
  expect(source).toMatch(/financialInstitutions=\{financialInstitutionsCatalog\}/);
  expect(source).not.toMatch(/loadFinancialInstitutionsByPaymentMethod/);
});

it("POS keeps the original shared catalog validation and selection", () => {
  expect(dialogSource).toMatch(
    /financialInstitutions\.filter\(\(i\) => i\.active !== false\)/
  );
  expect(dialogSource).toMatch(
    /requiresInst && !p\.financialInstitutionId && activeInstitutions\.length > 0/
  );
  expect(dialogSource).toMatch(/institutions=\{activeInstitutions\}/);
  expect(dialogSource).not.toMatch(/financialInstitutionsByMethodId/);
});
