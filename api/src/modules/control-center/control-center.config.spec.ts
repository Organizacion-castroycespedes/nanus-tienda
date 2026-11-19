import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PLATFORM_TENANT_ID, readControlCenterConfig } from "./control-center.config";

test("config: disabled unless CONTROL_CENTER_ENABLED=true", () => {
  const config = readControlCenterConfig({ CONTROL_CENTER_DB_USERNAME: "cc", CONTROL_CENTER_DB_PASSWORD: "x" });
  assert.equal(config.enabled, false);
  assert.equal(config.disabledReason, "FLAG_DISABLED");
  assert.equal(config.platformTenantId, DEFAULT_PLATFORM_TENANT_ID);
});

test("config: disabled when dedicated credentials are missing", () => {
  const config = readControlCenterConfig({ CONTROL_CENTER_ENABLED: "true", CONTROL_CENTER_DB_USERNAME: "cc" });
  assert.equal(config.enabled, false);
  assert.equal(config.disabledReason, "CREDENTIALS_MISSING");
});

test("config: disabled when platform tenant id is not a UUID", () => {
  const config = readControlCenterConfig({
    CONTROL_CENTER_ENABLED: "true",
    CONTROL_CENTER_DB_USERNAME: "cc",
    CONTROL_CENTER_DB_PASSWORD: "x",
    PLATFORM_TENANT_ID: "plataforma",
  });
  assert.equal(config.enabled, false);
  assert.equal(config.disabledReason, "PLATFORM_TENANT_INVALID");
});

test("config: enabled with flag, credentials and valid platform tenant", () => {
  const config = readControlCenterConfig({
    CONTROL_CENTER_ENABLED: " TRUE ",
    CONTROL_CENTER_DB_USERNAME: " manus_cc_local ",
    CONTROL_CENTER_DB_PASSWORD: "secret",
  });
  assert.equal(config.enabled, true);
  assert.equal(config.disabledReason, null);
  assert.equal(config.username, "manus_cc_local");
});
