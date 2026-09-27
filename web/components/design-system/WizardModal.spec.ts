import assert from "node:assert/strict";
import test from "node:test";
import { WizardModal, type WizardStepConfig } from "./WizardModal";

test("WizardModal exports component and types properly", () => {
  assert.equal(typeof WizardModal, "function");
  const steps: WizardStepConfig[] = [
    { key: "step1", label: "Paso 1" },
    { key: "step2", label: "Paso 2" },
  ];
  assert.equal(steps.length, 2);
  assert.equal(steps[0].key, "step1");
});
