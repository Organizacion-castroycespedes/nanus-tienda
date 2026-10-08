import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedEnrollmentEndpoint, type EnrollmentEndpointRuntime } from "../src/modules/agent-security/agent-enrollment-endpoint";

const sourceRuntime = (overrides: Partial<EnrollmentEndpointRuntime> = {}) => ({
  nodeEnv: "development",
  allowLoopbackHttp: "true",
  cwd: "D:\\work\\backend-perifericos",
  argv: ["D:\\work\\backend-perifericos\\src\\main.ts"],
  ...overrides,
});

test("allows HTTPS Agent enrollment endpoints in any runtime", () => {
  assert.equal(isAllowedEnrollmentEndpoint(new URL("https://api.example.test/api"), {
    nodeEnv: "production", allowLoopbackHttp: undefined,
    cwd: "D:\\work\\backend-perifericos", argv: ["D:\\work\\backend-perifericos\\dist\\main.js"],
  }), true);
});

test("allows HTTP only for explicit loopback source development", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    assert.equal(isAllowedEnrollmentEndpoint(new URL(`http://${host}:4020/api`), sourceRuntime()), true);
  }
});

test("rejects loopback HTTP unless every development-only condition is met", () => {
  const url = new URL("http://127.0.0.1:4020/api");
  assert.equal(isAllowedEnrollmentEndpoint(url, sourceRuntime({ allowLoopbackHttp: undefined })), false);
  assert.equal(isAllowedEnrollmentEndpoint(url, sourceRuntime({ nodeEnv: "production" })), false);
  assert.equal(isAllowedEnrollmentEndpoint(url, sourceRuntime({ argv: ["D:\\work\\backend-perifericos\\dist\\main.js"] })), false);
});

test("rejects HTTP to remote hosts and URLs with credentials or URL decorations", () => {
  for (const value of [
    "http://api.example.test/api",
    "http://127.0.0.2:4020/api",
    "http://user@127.0.0.1:4020/api",
    "http://127.0.0.1:4020/api?override=1",
    "http://127.0.0.1:4020/api#fragment",
  ]) {
    assert.equal(isAllowedEnrollmentEndpoint(new URL(value), sourceRuntime()), false, value);
  }
});
