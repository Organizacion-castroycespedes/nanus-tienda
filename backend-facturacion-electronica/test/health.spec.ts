import assert from "node:assert/strict";
import test from "node:test";
import { HealthController } from "../src/modules/health/health.controller";

test("health responds ok", () => {
  process.env.NODE_ENV = "test";
  process.env.SERVICE_NAME = "backend-facturacion-electronica";

  const controller = new HealthController();
  const result = controller.getHealth();

  assert.equal(result.status, "ok");
  assert.equal(result.service, "backend-facturacion-electronica");
  assert.equal(result.environment, "test");
  assert.match(result.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});
