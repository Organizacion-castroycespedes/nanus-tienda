import assert from "node:assert/strict";
import test from "node:test";
import { HealthController } from "../src/modules/health/health.controller";

test("health responds with MOCK agent metadata", () => {
  process.env.PERIPHERALS_AGENT_NAME = "manus-pos-peripheral-agent";
  process.env.PERIPHERALS_MODE = "MOCK";

  const controller = new HealthController();
  const result = controller.getHealth();

  assert.equal(result.status, "ok");
  assert.equal(result.agent, "manus-pos-peripheral-agent");
  assert.equal(result.mode, "MOCK");
  assert.equal(result.version, "0.1.0");
  assert.equal(typeof result.uptimeSeconds, "number");
});
