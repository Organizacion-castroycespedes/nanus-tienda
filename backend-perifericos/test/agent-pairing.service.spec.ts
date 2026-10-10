import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import { DpapiAgentSecretStore } from "../src/modules/agent-security/agent-secret.store";
import { AgentPairingService } from "../src/modules/agent-security/agent-pairing.service";
import { AgentInstallationIdentityProvider } from "../src/shared/identity/agent-installation-id";
import { LogsService } from "../src/modules/logs/logs.service";

const runtimeBaseUrl = "https://agent-api.test";
const credential = {
  credentialId: "qa-credential-id",
  secret: "test-only-agent-secret-not-for-logs",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};
const environmentKeys = [
  "PERIPHERALS_ENROLLMENT_API_BASE_URL",
  "PERIPHERALS_ENROLLMENT_SIGNING_PUBLIC_KEY_PEM",
  "PERIPHERALS_ENROLLMENT_AUDIENCE",
  "PERIPHERALS_ENROLLMENT_SIGNING_KEY_ID",
  "PERIPHERALS_ENROLLMENT_ALLOW_LOOPBACK_HTTP",
] as const;

const isolateAgentEnvironment = () => {
  const previous = new Map(environmentKeys.map((key) => [key, process.env[key]]));
  for (const key of environmentKeys) delete process.env[key];
  process.env.PERIPHERALS_ENROLLMENT_API_BASE_URL = runtimeBaseUrl;
  return () => {
    for (const key of environmentKeys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
};

const credentialBytes = () => Buffer.from(JSON.stringify(credential), "utf8");

test("an existing DPAPI credential validates with only the API base URL", async (t) => {
  const restoreEnvironment = isolateAgentEnvironment();
  t.after(restoreEnvironment);
  const secretReads: string[] = [];
  t.mock.method(DpapiAgentSecretStore.prototype, "read", async (name: string) => {
    secretReads.push(name);
    return name === "agent-credential" ? credentialBytes() : null;
  });
  t.mock.method(AgentInstallationIdentityProvider.prototype, "getInstallationId", () => "installation-test-id");
  const requests: Array<{ url: string; authorization: string | null }> = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), authorization: new Headers(init?.headers).get("authorization") });
    return new Response(JSON.stringify({ authenticated: true }), { status: 200 });
  });

  const result = await new AgentPairingService().status();

  assert.equal(result.enrolled, true);
  assert.equal(result.pairing, null);
  assert.deepEqual(secretReads, ["agent-credential"]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, `${runtimeBaseUrl}/scale-authorization/agent/validate`);
  assert.match(requests[0].authorization ?? "", /^Agent qa-credential-id\./);
});

test("REAL readiness and sale-capture observations use runtime auth without pairing trust", async (t) => {
  const restoreEnvironment = isolateAgentEnvironment();
  t.after(restoreEnvironment);
  t.mock.method(DpapiAgentSecretStore.prototype, "read", async (name: string) =>
    name === "agent-credential" ? credentialBytes() : null
  );
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    requests.push(String(input));
    return new Response(JSON.stringify({ accepted: true }), { status: 200 });
  });
  const service = new AgentPairingService();

  await service.submitRealObservation({
    posTerminalId: "pos-terminal-test",
    logicalScaleId: "scale-test",
    source: "REAL",
    unit: "kg",
    unitVerified: true,
    observedAt: new Date().toISOString(),
  });
  await service.submitSaleCaptureObservation({
    captureId: "capture-test",
    deviceId: "device-test",
    weight: 0.245,
    unit: "kg",
    source: "REAL",
    unitVerified: true,
    observedAt: new Date().toISOString(),
  });

  assert.deepEqual(requests, [
    `${runtimeBaseUrl}/scale-authorization/agent/readiness`,
    `${runtimeBaseUrl}/scale-authorization/agent/weight-captures/observation`,
  ]);
});

test("pairing start still fails closed when any trust field is missing", async (t) => {
  const restoreEnvironment = isolateAgentEnvironment();
  t.after(restoreEnvironment);
  const reads: string[] = [];
  t.mock.method(DpapiAgentSecretStore.prototype, "read", async (name: string) => {
    reads.push(name);
    return null;
  });
  let fetchCount = 0;
  t.mock.method(globalThis, "fetch", async () => {
    fetchCount += 1;
    return new Response("{}", { status: 200 });
  });

  await assert.rejects(() => new AgentPairingService().startPairing(), /AGENT_PAIRING_NOT_CONFIGURED/);
  assert.deepEqual(reads, []);
  assert.equal(fetchCount, 0);
});

test("pairing start rejects a valid non-Ed25519 trust key before side effects", async (t) => {
  const restoreEnvironment = isolateAgentEnvironment();
  t.after(restoreEnvironment);
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.PERIPHERALS_ENROLLMENT_SIGNING_PUBLIC_KEY_PEM = rsa.publicKey
    .export({ type: "spki", format: "pem" })
    .toString();
  process.env.PERIPHERALS_ENROLLMENT_AUDIENCE = "test-audience";
  process.env.PERIPHERALS_ENROLLMENT_SIGNING_KEY_ID = "test-key-id";
  const reads: string[] = [];
  t.mock.method(DpapiAgentSecretStore.prototype, "read", async (name: string) => {
    reads.push(name);
    return null;
  });
  let fetchCount = 0;
  t.mock.method(globalThis, "fetch", async () => {
    fetchCount += 1;
    return new Response("{}", { status: 200 });
  });

  await assert.rejects(() => new AgentPairingService().startPairing(), /AGENT_PAIRING_TRUST_KEY_INVALID/);
  assert.deepEqual(reads, []);
  assert.equal(fetchCount, 0);
});

test("an API-rejected credential stays unenrolled and never starts pairing or becomes READY", async (t) => {
  const restoreEnvironment = isolateAgentEnvironment();
  t.after(restoreEnvironment);
  t.mock.method(DpapiAgentSecretStore.prototype, "read", async (name: string) =>
    name === "agent-credential" ? credentialBytes() : null
  );
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    requests.push(String(input));
    return new Response("{}", { status: 403 });
  });
  const service = new AgentPairingService();

  const result = await service.status();
  assert.equal(result.enrolled, false);
  await assert.rejects(
    () => service.submitRealObservation({
      posTerminalId: "pos-terminal-test",
      logicalScaleId: "scale-test",
      source: "REAL",
      unit: "kg",
      unitVerified: true,
      observedAt: new Date().toISOString(),
    }),
    /AGENT_READINESS_REQUEST_FAILED/
  );
  assert.deepEqual(requests, [
    `${runtimeBaseUrl}/scale-authorization/agent/validate`,
    `${runtimeBaseUrl}/scale-authorization/agent/readiness`,
  ]);
  assert.equal(requests.some((url) => url.endsWith("/pairing/challenge")), false);
});

test("runtime credential checks do not log credential material", async (t) => {
  const restoreEnvironment = isolateAgentEnvironment();
  t.after(restoreEnvironment);
  t.mock.method(DpapiAgentSecretStore.prototype, "read", async (name: string) =>
    name === "agent-credential" ? credentialBytes() : null
  );
  t.mock.method(AgentInstallationIdentityProvider.prototype, "getInstallationId", () => "installation-test-id");
  t.mock.method(globalThis, "fetch", async () => new Response("{}", { status: 200 }));
  const capturedLogs: string[] = [];
  for (const method of ["log", "warn", "error"] as const) {
    t.mock.method(console, method, (...values: unknown[]) => {
      capturedLogs.push(values.map(String).join(" "));
    });
  }

  await new AgentPairingService().status();

  assert.equal(capturedLogs.some((line) => line.includes(credential.secret)), false);
});

test("sale observation telemetry records accepted response and READY without measurement or credentials", async (t) => {
  const restoreEnvironment = isolateAgentEnvironment();
  t.after(restoreEnvironment);
  t.mock.method(DpapiAgentSecretStore.prototype, "read", async (name: string) =>
    name === "agent-credential" ? credentialBytes() : null
  );
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    captureId: "capture-safe-test", status: "READY", expiresAt: new Date(Date.now() + 60_000).toISOString(),
  }), { status: 200 }));
  const logs = new LogsService();
  const service = new AgentPairingService(logs);

  await service.submitSaleCaptureObservation({ captureId: "capture-safe-test", deviceId: "device-safe-test",
    weight: 0.245, unit: "kg", source: "REAL", unitVerified: true, observedAt: new Date().toISOString() });

  const events = logs.list().map((entry) => entry.event);
  assert.deepEqual(events, [
    "capture.ready_confirmed", "capture.observation_response_received", "capture.observation_send_started",
  ]);
  const serialized = JSON.stringify(logs.list()).toLowerCase();
  for (const sensitive of [credential.secret, "authorization", "nonce", "verifier", "0.245", "weight"]) {
    assert.equal(serialized.includes(sensitive.toLowerCase()), false, `telemetry must not contain ${sensitive}`);
  }
});

for (const httpStatus of [422, 503]) {
  test(`sale observation telemetry records API HTTP ${httpStatus} without response body`, async (t) => {
    const restoreEnvironment = isolateAgentEnvironment();
    t.after(restoreEnvironment);
    t.mock.method(DpapiAgentSecretStore.prototype, "read", async (name: string) =>
      name === "agent-credential" ? credentialBytes() : null
    );
    t.mock.method(globalThis, "fetch", async () => new Response("sensitive arbitrary body", { status: httpStatus }));
    const logs = new LogsService();

    await assert.rejects(() => new AgentPairingService(logs).submitSaleCaptureObservation({
      captureId: "capture-http-test", deviceId: "device-safe-test", weight: 0.245, unit: "kg",
      source: "REAL", unitVerified: true, observedAt: new Date().toISOString(),
    }), (error) => error instanceof ServiceUnavailableException
      && error.getStatus() === 503 && error.message.includes("AGENT_CAPTURE_OBSERVATION_REQUEST_FAILED"));

    const responseLog = logs.list().find((entry) => entry.event === "capture.observation_response_received");
    assert.equal(responseLog?.metadata.httpStatus, httpStatus);
    assert.equal(responseLog?.metadata.errorCode, httpStatus >= 500 ? "OBSERVATION_API_HTTP_5XX" : "OBSERVATION_API_HTTP_4XX");
    assert.equal(JSON.stringify(logs.list()).includes("sensitive arbitrary body"), false);
  });
}

test("sale observation telemetry classifies a network timeout and preserves the original error", async (t) => {
  const restoreEnvironment = isolateAgentEnvironment();
  t.after(restoreEnvironment);
  t.mock.method(DpapiAgentSecretStore.prototype, "read", async (name: string) =>
    name === "agent-credential" ? credentialBytes() : null
  );
  const timeout = new DOMException("do not log this detail", "TimeoutError");
  t.mock.method(globalThis, "fetch", async () => { throw timeout; });
  const logs = new LogsService();

  await assert.rejects(() => new AgentPairingService(logs).submitSaleCaptureObservation({
    captureId: "capture-timeout-test", deviceId: "device-safe-test", weight: 0.245, unit: "kg",
    source: "REAL", unitVerified: true, observedAt: new Date().toISOString(),
  }), (error) => error === timeout);

  const failed = logs.list().find((entry) => entry.event === "capture.failed");
  assert.equal(failed?.metadata.stage, "observation_send");
  assert.equal(failed?.metadata.errorCode, "OBSERVATION_NETWORK_TIMEOUT");
  assert.equal(JSON.stringify(logs.list()).includes("do not log this detail"), false);
});

test("sale observation telemetry classifies a network failure without logging its message", async (t) => {
  const restoreEnvironment = isolateAgentEnvironment();
  t.after(restoreEnvironment);
  t.mock.method(DpapiAgentSecretStore.prototype, "read", async (name: string) =>
    name === "agent-credential" ? credentialBytes() : null
  );
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("sensitive network detail"); });
  const logs = new LogsService();

  await assert.rejects(() => new AgentPairingService(logs).submitSaleCaptureObservation({
    captureId: "capture-network-test", deviceId: "device-safe-test", weight: 0.245, unit: "kg",
    source: "REAL", unitVerified: true, observedAt: new Date().toISOString(),
  }), /sensitive network detail/);

  const failed = logs.list().find((entry) => entry.event === "capture.failed");
  assert.equal(failed?.metadata.errorCode, "OBSERVATION_NETWORK_ERROR");
  assert.equal(JSON.stringify(logs.list()).includes("sensitive network detail"), false);
});
