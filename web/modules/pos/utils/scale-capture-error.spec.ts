import assert from "node:assert/strict";
import test from "node:test";
import { PeripheralAgentRequestError } from "../../../domains/peripherals/api";
import { getScaleCaptureOperatorMessage } from "./scale-capture-error";

test("maps only the semantic SCALE_WEIGHT_ZERO code to the cashier instruction", () => {
  assert.equal(
    getScaleCaptureOperatorMessage(new PeripheralAgentRequestError("SCALE_WEIGHT_ZERO", "SCALE_WEIGHT_ZERO")),
    "Coloca el producto en la balanza para continuar.",
  );
  assert.equal(
    getScaleCaptureOperatorMessage(new PeripheralAgentRequestError("AGENT_OFFLINE", "Agent offline")),
    undefined,
  );
  assert.equal(getScaleCaptureOperatorMessage(new Error("La captura REAL no fue aceptada")), undefined);
});
