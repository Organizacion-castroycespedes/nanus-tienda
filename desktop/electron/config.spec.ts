import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveElectronConfig,
  type ElectronConfigEnv,
  validateVersionedShellConfig,
} from "./config.js";

const resolve = (env: ElectronConfigEnv = {}) => resolveElectronConfig(env);

describe("resolveElectronConfig", () => {
  it("opens the hosted login page by default", () => {
    const config = resolve();

    assert.equal(config.webBaseUrl.href, "https://www.apptiendamanus.space/login");
    assert.equal(config.initialUrl.href, "https://www.apptiendamanus.space/login");
    assert.equal(config.startPath, null);
    assert.equal(config.tenantId, null);
    assert.equal(config.branchId, null);
    assert.equal(config.terminalId, null);
  });

  it("uses MANUS_WEB_URL when configured", () => {
    const config = resolve({
      MANUS_WEB_URL: "https://www.apptiendamanus.space",
    });

    assert.equal(config.webBaseUrl.href, "https://www.apptiendamanus.space/");
    assert.equal(config.initialUrl.href, "https://www.apptiendamanus.space/");
  });

  it("uses MANUS_START_PATH when it starts with slash", () => {
    const config = resolve({
      MANUS_START_PATH: "/login",
    });

    assert.equal(config.startPath, "/login");
    assert.equal(config.initialUrl.href, "https://www.apptiendamanus.space/login");
  });

  it("rejects MANUS_START_PATH when it does not start with slash", () => {
    assert.throws(
      () =>
        resolve({
          MANUS_START_PATH: "login",
        }),
      /MANUS_START_PATH must start with a single \//
    );
  });

  it("uses tenant id as initial path when MANUS_START_PATH is missing", () => {
    const config = resolve({
      MANUS_TENANT_ID: "tenant-demo",
    });

    assert.equal(config.tenantId, "tenant-demo");
    assert.equal(config.initialUrl.href, "https://www.apptiendamanus.space/tenant-demo");
  });

  it("gives MANUS_START_PATH priority over tenant id", () => {
    const config = resolve({
      MANUS_TENANT_ID: "tenant-demo",
      MANUS_START_PATH: "/login",
    });

    assert.equal(config.tenantId, "tenant-demo");
    assert.equal(config.initialUrl.href, "https://www.apptiendamanus.space/login");
  });

  it("reads branch and terminal without changing the startup URL", () => {
    const config = resolve({
      MANUS_BRANCH_ID: "branch-1",
      MANUS_TERMINAL_ID: "terminal-1",
    });

    assert.equal(config.branchId, "branch-1");
    assert.equal(config.terminalId, "terminal-1");
    assert.equal(config.initialUrl.href, "https://www.apptiendamanus.space/login");
  });
});

describe("validateVersionedShellConfig", () => {
  const valid = {
    environment: "qa" as const,
    frontendUrl: "https://www.apptiendamanus.space",
    allowedOrigins: ["https://www.apptiendamanus.space"],
    agentLoopbackOrigin: "http://127.0.0.1:4050",
  };

  it("accepts the approved QA configuration", () => {
    assert.deepEqual(validateVersionedShellConfig(valid), {
      ...valid,
      frontendUrl: "https://www.apptiendamanus.space/",
    });
  });

  it("uses NEXT_PUBLIC_MANUS_WEB_URL when MANUS_WEB_URL is missing", () => {
    const config = resolve({
      NEXT_PUBLIC_MANUS_WEB_URL: "https://staging.example.com/login",
    });

    assert.equal(config.webBaseUrl.href, "https://staging.example.com/login");
    assert.equal(config.initialUrl.href, "https://staging.example.com/login");
  });

  it("prioritizes MANUS_WEB_URL over NEXT_PUBLIC_MANUS_WEB_URL", () => {
    const config = resolve({
      MANUS_WEB_URL: "https://desktop.example.com",
      NEXT_PUBLIC_MANUS_WEB_URL: "https://next.example.com",
    });

    assert.equal(config.webBaseUrl.href, "https://desktop.example.com/");
  });

  it("uses the default when NEXT_PUBLIC_MANUS_WEB_URL is invalid", () => {
    const config = resolve({
      NEXT_PUBLIC_MANUS_WEB_URL: "not-a-url",
    });

    assert.equal(config.webBaseUrl.href, "https://www.apptiendamanus.space/login");
  });

  it("preserves the packaged login startup path", () => {
    const config = validateVersionedShellConfig({
      ...valid,
      frontendUrl: "https://www.apptiendamanus.space/login",
    });

    assert.equal(config.frontendUrl, "https://www.apptiendamanus.space/login");
  });

  it("rejects invalid environment, frontend, and agent origins", () => {
    assert.throws(() => validateVersionedShellConfig({ ...valid, environment: "dev" }));
    assert.throws(() => validateVersionedShellConfig({ ...valid, frontendUrl: "http://localhost:3000" }));
    assert.throws(() => validateVersionedShellConfig({ ...valid, allowedOrigins: ["https://other.example"] }));
    assert.throws(() => validateVersionedShellConfig({ ...valid, agentLoopbackOrigin: "http://0.0.0.0:4050" }));
    assert.throws(() => validateVersionedShellConfig({ ...valid, agentLoopbackOrigin: "http://192.168.1.20:4050" }));
  });
});
