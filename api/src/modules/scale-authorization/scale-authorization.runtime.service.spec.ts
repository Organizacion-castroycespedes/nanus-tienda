import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Logger } from "@nestjs/common";
import { issueOpaqueAgentCredential } from "./domain/agent-credential.domain";
import { ScaleAuthorizationRuntimeService, WEIGHT_CAPTURE_READY_STATEMENT_TIMEOUT_MS } from "./scale-authorization.runtime.service";
import { ScaleAuthorizationPairingController } from "./scale-authorization.runtime.controller";

const captureObservationLogs = async (run: () => Promise<void>) => {
  const entries: string[] = [];
  const originalLog = Logger.prototype.log;
  const originalError = Logger.prototype.error;
  Logger.prototype.log = function (message?: unknown) { if (typeof message === "string") entries.push(message); };
  Logger.prototype.error = function (message?: unknown) { if (typeof message === "string") entries.push(message); };
  try { await run(); } finally {
    Logger.prototype.log = originalLog;
    Logger.prototype.error = originalError;
  }
  return entries.map((entry) => JSON.parse(entry) as Record<string, unknown>);
};

const makeObservationPipeline = (options: { status?: string; failReady?: Error; failReadySync?: Error; failRollback?: Error } = {}) => {
  const statements: string[] = [];
  const queries: string[] = [];
  const statementTimeouts: unknown[] = [];
  const events: string[] = [];
  const client = {
    query: async (sql: string, params?: unknown[]) => {
      queries.push(sql.trim());
      statements.push(sql.trim().split(/\s+/).slice(0, 3).join(" "));
      events.push(`query:${sql.trim().split(/\s+/).slice(0, 2).join(" ")}`);
      if (sql.trim() === "ROLLBACK" && options.failRollback) throw options.failRollback;
      if (sql.includes("set_config('statement_timeout'")) statementTimeouts.push(params?.[0]);
      if (sql.includes("FROM terminal_scale_weight_captures WHERE capture_id = $1 FOR UPDATE")) return { rows: [{
        tenant_id: "tenant-1", terminal_device_id: "device-1", logical_scale_id: "scale-1",
        created_at: new Date(Date.now() - 2_000), expires_at: new Date(Date.now() + 60_000), status: options.status ?? "PENDING",
      }], rowCount: 1 };
      if (sql.includes("FROM terminal_device_credentials c JOIN terminal_devices d")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("SELECT 1 FROM terminal_scale_weight_captures c")) return { rows: [{}], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
    release: (error?: Error) => { events.push(error ? "release:discard" : "release"); },
  };
  const captures = { markReady: () => {
    events.push("markReady");
    if (options.failReadySync) throw options.failReadySync;
    if (options.failReady) return Promise.reject(options.failReady);
    return Promise.resolve({ capture_id: "40000000-0000-4000-8000-000000000001", status: "READY",
      expires_at: new Date(Date.now() + 60_000), weight_kg: "0.245000" });
  } };
  const service = new ScaleAuthorizationRuntimeService({ getClient: async () => client } as never,
    {} as never, {} as never, captures as never);
  return { service, statements, queries, statementTimeouts, events };
};

const makeService = (state: { credentialId: string; verifier: string; expiresAt: Date; revokedAt: Date | null; deviceActive: boolean }) => {
  const client = {
    query: async (sql: string) => {
      if (sql.includes("FROM terminal_device_credentials c JOIN terminal_devices")) {
        return { rows: state.deviceActive && state.expiresAt > new Date() ? [{
          id: "credential-row", tenant_id: "tenant-1", terminal_device_id: "device-1",
          verifier_sha256: state.verifier, expires_at: state.expiresAt, revoked_at: state.revokedAt,
        }] : [], rowCount: state.deviceActive && state.expiresAt > new Date() ? 1 : 0 };
      }
      throw new Error("UNEXPECTED_QUERY");
    },
    release: () => undefined,
  };
  const database = { getClient: async () => client } as never;
  return new ScaleAuthorizationRuntimeService(database, {} as never, {} as never, {} as never);
};

test("Agent authentication verifies the opaque credential and returns only its scoped identity internally", async () => {
  const issued = issueOpaqueAgentCredential();
  const credentialId = randomUUID();
  const service = makeService({ credentialId, verifier: issued.verifierSha256,
    expiresAt: new Date(Date.now() + 60_000), revokedAt: null, deviceActive: true });
  const authenticated = await service.authenticateAgent(`Agent ${credentialId}.${issued.secret}`);
  assert.deepEqual(authenticated, { tenantId: "tenant-1", terminalDeviceId: "device-1",
    credentialId, credentialSecret: issued.secret });
  await assert.rejects(service.authenticateAgent(`Agent ${credentialId}.${"x".repeat(43)}`), ForbiddenException);
});

test("Agent authentication fails closed for expired, revoked or revoked-device credentials", async () => {
  const issued = issueOpaqueAgentCredential();
  const credentialId = randomUUID();
  const request = `Agent ${credentialId}.${issued.secret}`;
  for (const overrides of [
    { expiresAt: new Date(Date.now() - 1_000) },
    { revokedAt: new Date() },
    { deviceActive: false },
  ]) {
    const service = makeService({ credentialId, verifier: issued.verifierSha256,
      expiresAt: new Date(Date.now() + 60_000), revokedAt: null, deviceActive: true, ...overrides });
    await assert.rejects(service.authenticateAgent(request), ForbiddenException);
  }
});

test("operator KG confirmation returns backend-persisted evidence for the Agent mirror", async () => {
  const statements: string[] = [];
  const client = {
    query: async (sql: string) => {
      statements.push(sql.trim().split(/\s+/).slice(0, 2).join(" "));
      if (sql.includes("FROM terminal_scale_bindings b")) return { rows: [{
        tenantId: "tenant-1", branchId: "branch-1", posTerminalId: "pos-1",
        operationalTerminalId: "terminal-1", terminalDeviceId: "device-1", logicalScaleId: "rochi-1",
      }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
    release: () => undefined,
  };
  const database = { getClient: async () => client } as never;
  const bindings = { authorize: async (_client: unknown, input: {
    expectedContext: { branchId: string; posTerminalId: string; operationalTerminalId: string; terminalDeviceId: string; logicalScaleId: string };
    confirmation: { method: string; displayedUnit: string; operatorId: string; confirmedAt: string };
  }) => {
    assert.deepEqual(input.expectedContext, { tenantId: "tenant-1", branchId: "branch-1", posTerminalId: "pos-1",
      operationalTerminalId: "terminal-1", terminalDeviceId: "device-1", logicalScaleId: "rochi-1" });
    assert.deepEqual(input.confirmation, { method: "OPERATOR_CONFIRMATION", displayedUnit: "kg",
      operatorId: "operator-1", confirmedAt: input.confirmation.confirmedAt });
    return { id: "binding-1", status: "AUTHORIZED", unit_state: "KG_VERIFIED" };
  } } as never;
  const service = new ScaleAuthorizationRuntimeService(database, {} as never, bindings, {} as never);
  const result = await service.confirmKg("tenant-1", "operator-1", "binding-1");
  assert.equal(result.status, "AUTHORIZED");
  assert.equal(result.unit_state, "KG_VERIFIED");
  assert.equal(result.unitVerification.method, "OPERATOR_CONFIRMATION");
  assert.equal(result.unitVerification.unit, "kg");
  assert.equal(result.unitVerification.operatorId, "operator-1");
  assert.equal(Number.isFinite(Date.parse(result.unitVerification.verifiedAt)), true);
  assert.deepEqual(statements, ["BEGIN", "SELECT b.tenant_id", "COMMIT"]);
});

test("commercial capture observation rejects MOCK, non-KG, unverified and stale readings before persistence", async () => {
  const service = new ScaleAuthorizationRuntimeService({} as never, {} as never, {} as never, {} as never);
  const common = { captureId: randomUUID(), deviceId: "scale-1", weight: 0.245, unit: "kg", source: "REAL", unitVerified: true, observedAt: new Date().toISOString() };
  for (const input of [
    { ...common, source: "MOCK" },
    { ...common, unit: "lb" },
    { ...common, unitVerified: false },
    { ...common, weight: Number.NaN },
    { ...common, observedAt: new Date(Date.now() - 16_000).toISOString() },
  ]) {
    await assert.rejects(service.submitCaptureObservation({ tenantId: "tenant-1", terminalDeviceId: "device-1", credentialId: "credential-1" }, input),
      (error: unknown) => error instanceof BadRequestException || error instanceof Error && error.message === "CAPTURE_OBSERVATION_STALE");
  }
});

test("Agent observation marks only its matching live PENDING capture READY", async () => {
  const statements: string[] = [];
  const client = { query: async (sql: string) => {
    statements.push(sql.trim().split(/\s+/).slice(0, 3).join(" "));
    if (sql.includes("FROM terminal_scale_weight_captures WHERE capture_id")) return { rows: [{
      tenant_id: "tenant-1", terminal_device_id: "device-1", logical_scale_id: "scale-1", created_at: new Date(Date.now() - 2_000),
      expires_at: new Date(Date.now() + 60_000), status: "PENDING",
    }], rowCount: 1 };
    return { rows: [{}], rowCount: 1 };
  }, release: () => undefined };
  const database = { getClient: async () => client } as never;
  const captures = { markReady: async (_client: unknown, input: { captureId: string; observation: { value: number; source: string; unit: string; unitVerified: boolean } }) => {
    assert.equal(input.captureId, "40000000-0000-4000-8000-000000000001");
    assert.deepEqual(input.observation, { value: 0.245, source: "REAL", unit: "kg", unitVerified: true, observedAt: input.observation.observedAt });
    return { capture_id: input.captureId, status: "READY", expires_at: new Date(Date.now() + 60_000), weight_kg: "0.245000" };
  } } as never;
  const service = new ScaleAuthorizationRuntimeService(database, {} as never, {} as never, captures);
  const result = await service.submitCaptureObservation({ tenantId: "tenant-1", terminalDeviceId: "device-1", credentialId: "cred" }, {
    captureId: "40000000-0000-4000-8000-000000000001", deviceId: "scale-1", weight: 0.245, unit: "kg", source: "REAL",
    unitVerified: true, observedAt: new Date().toISOString(),
  });
  assert.equal(result.status, "READY");
  assert.equal(result.weightKg, "0.245000");
  assert.equal(statements[0], "BEGIN");
  assert.ok(statements.some((statement) => statement.startsWith("SELECT set_config('statement_timeout'")));
  assert.match(statements[1], /SELECT tenant_id, terminal_device_id,/);
  assert.equal(statements.filter((statement) => statement === "SELECT 1 FROM").length, 2);
  assert.equal(statements[statements.length - 1], "COMMIT");
});

test("READY statements receive a transaction-local PostgreSQL timeout below the Agent deadline", async () => {
  const { service, statementTimeouts, events, queries } = makeObservationPipeline();
  assert.ok(WEIGHT_CAPTURE_READY_STATEMENT_TIMEOUT_MS < 10_000);
  await service.submitCaptureObservation({ tenantId: "tenant-1", terminalDeviceId: "device-1", credentialId: "cred" }, {
    captureId: "40000000-0000-4000-8000-000000000001", deviceId: "scale-1", weight: 0.245,
    unit: "kg", source: "REAL", unitVerified: true, observedAt: new Date().toISOString(),
  });
  assert.deepEqual(statementTimeouts, [`${WEIGHT_CAPTURE_READY_STATEMENT_TIMEOUT_MS}ms`]);
  assert.equal(queries.includes("SELECT set_config('statement_timeout', $1, true)"), true);
  assert.ok(events.indexOf("query:SELECT set_config('statement_timeout',") < events.indexOf("markReady"));
  assert.ok(events.indexOf("query:COMMIT") < events.indexOf("release"));
  assert.equal(events.at(-1), "release");
});

test("PostgreSQL statement cancellation rolls back READY and emits the failure stage", async () => {
  const timeoutError = Object.assign(new Error("database cancellation detail must not be logged"), { code: "57014" });
  const { service, statements } = makeObservationPipeline({ failReady: timeoutError });
  let thrown: unknown;
  const logs = await captureObservationLogs(async () => {
    try {
      await service.submitCaptureObservation({ tenantId: "tenant-1", terminalDeviceId: "device-1", credentialId: "credential-1" }, {
        captureId: "40000000-0000-4000-8000-000000000001", deviceId: "scale-1", weight: 0.245,
        unit: "kg", source: "REAL", unitVerified: true, observedAt: new Date().toISOString(),
      });
    } catch (error) { thrown = error; }
  });
  assert.equal(thrown, timeoutError);
  const failed = logs.find((entry) => entry.event === "observation.failed");
  assert.equal(failed?.stage, "ready_update");
  assert.equal(failed?.sqlState, "57014");
  assert.equal(logs.some((entry) => entry.event === "observation.ready_update_completed"), false);
  assert.equal(statements.at(-1), "ROLLBACK");
  assert.equal(statements.includes("COMMIT"), false);
  assert.equal(JSON.stringify(logs).includes("database cancellation detail"), false);
});

test("failed rollback discards the pooled client and preserves the original cancellation", async () => {
  const timeoutError = Object.assign(new Error("timeout detail"), { code: "57014" });
  const { service, events } = makeObservationPipeline({ failReady: timeoutError, failRollback: new Error("rollback detail") });
  await assert.rejects(service.submitCaptureObservation({ tenantId: "tenant-1", terminalDeviceId: "device-1", credentialId: "credential-1" }, {
    captureId: "40000000-0000-4000-8000-000000000001", deviceId: "scale-1", weight: 0.245,
    unit: "kg", source: "REAL", unitVerified: true, observedAt: new Date().toISOString(),
  }), (error: unknown) => error === timeoutError);
  assert.equal(events.at(-1), "release:discard");
});

test("Agent observation rejects consumed captures and browser callers without Agent credentials", async () => {
  const client = { query: async () => ({ rows: [{ tenant_id: "tenant-1", terminal_device_id: "device-1", logical_scale_id: "scale-1",
    created_at: new Date(Date.now() - 2_000), expires_at: new Date(Date.now() + 60_000), status: "CONSUMED" }], rowCount: 1 }),
    release: () => undefined };
  const service = new ScaleAuthorizationRuntimeService({ getClient: async () => client } as never, {} as never, {} as never, {} as never);
  await assert.rejects(service.submitCaptureObservation({ tenantId: "tenant-1", terminalDeviceId: "device-1", credentialId: "cred" }, {
    captureId: "40000000-0000-4000-8000-000000000001", deviceId: "scale-1", weight: 0.245, unit: "kg", source: "REAL", unitVerified: true,
    observedAt: new Date().toISOString(),
  }), ConflictException);
  const controller = new ScaleAuthorizationPairingController(service);
  await assert.rejects(controller.captureObservation(undefined, {
    captureId: "40000000-0000-4000-8000-000000000001", deviceId: "scale-1", weight: 0.245, unit: "kg", source: "REAL", unitVerified: true,
    observedAt: new Date().toISOString(),
  }), ForbiddenException);
});

test("commercial observation logs safe stages through READY without recording its weight or credential", async () => {
  const { service, statements } = makeObservationPipeline();
  const logs = await captureObservationLogs(async () => {
    const result = await service.submitCaptureObservation({
      tenantId: "tenant-1", terminalDeviceId: "device-1", credentialId: "credential-safe-test",
      credentialSecret: "secret-marker-never-log",
    }, {
      captureId: "40000000-0000-4000-8000-000000000001", deviceId: "scale-1", weight: 987.654321,
      unit: "kg", source: "REAL", unitVerified: true, observedAt: new Date().toISOString(),
    });
    assert.equal(result.status, "READY");
  });
  assert.deepEqual(logs.map((entry) => entry.event), [
    "observation.capture_loaded", "observation.capture_state_validated", "observation.context_validated",
    "observation.ready_update_started", "observation.ready_update_completed",
  ]);
  assert.equal(statements.at(-1), "COMMIT");
  const serialized = JSON.stringify(logs);
  for (const forbidden of ["987.654321", "secret-marker-never-log", "credential-safe-test", "Authorization", "nonce", "verifier"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("commercial observation logs domain rejection stage and preserves its HTTP exception", async () => {
  const { service, statements } = makeObservationPipeline({ status: "CONSUMED" });
  let originalError: unknown;
  const logs = await captureObservationLogs(async () => {
    try {
      await service.submitCaptureObservation({ tenantId: "tenant-1", terminalDeviceId: "device-1", credentialId: "credential-1" }, {
        captureId: "40000000-0000-4000-8000-000000000001", deviceId: "scale-1", weight: 0.245,
        unit: "kg", source: "REAL", unitVerified: true, observedAt: new Date().toISOString(),
      });
    } catch (error) { originalError = error; }
  });
  assert.ok(originalError instanceof ConflictException);
  assert.equal((originalError as ConflictException).getStatus(), 409);
  const failed = logs.find((entry) => entry.event === "observation.failed");
  assert.equal(failed?.stage, "capture_state_validation");
  assert.equal(failed?.httpStatus, 409);
  assert.equal(failed?.errorCode, "CAPTURE_NOT_PENDING_OR_EXPIRED");
  assert.equal(statements.at(-1), "ROLLBACK");
});

test("synchronous READY repository errors are logged and rethrown unchanged", async () => {
  const repositoryError = new Error("repository failure marker");
  const { service, statements } = makeObservationPipeline({ failReadySync: repositoryError });
  let thrown: unknown;
  const logs = await captureObservationLogs(async () => {
    try {
      await service.submitCaptureObservation({ tenantId: "tenant-1", terminalDeviceId: "device-1", credentialId: "credential-1" }, {
        captureId: "40000000-0000-4000-8000-000000000001", deviceId: "scale-1", weight: 0.245,
        unit: "kg", source: "REAL", unitVerified: true, observedAt: new Date().toISOString(),
      });
    } catch (error) { thrown = error; }
  });
  assert.equal(thrown, repositoryError);
  assert.equal(logs.some((entry) => entry.event === "observation.ready_update_started"), true);
  const failed = logs.find((entry) => entry.event === "observation.failed");
  assert.equal(failed?.stage, "ready_update");
  assert.equal(statements.at(-1), "ROLLBACK");
});

test("repository failure logs safe PostgreSQL metadata and rethrows the same exception", async () => {
  const databaseError = Object.assign(new Error("do not log database message"), {
    code: "23514", constraint: "terminal_scale_weight_captures_measurement_check",
  });
  const { service } = makeObservationPipeline({ failReady: databaseError });
  let thrown: unknown;
  const logs = await captureObservationLogs(async () => {
    try {
      await service.submitCaptureObservation({ tenantId: "tenant-1", terminalDeviceId: "device-1", credentialId: "credential-1" }, {
        captureId: "40000000-0000-4000-8000-000000000001", deviceId: "scale-1", weight: 0.245,
        unit: "kg", source: "REAL", unitVerified: true, observedAt: new Date().toISOString(),
      });
    } catch (error) { thrown = error; }
  });
  assert.equal(thrown, databaseError);
  const failed = logs.find((entry) => entry.event === "observation.failed");
  assert.equal(failed?.stage, "ready_update");
  assert.equal(failed?.sqlState, "23514");
  assert.equal(failed?.constraint, "terminal_scale_weight_captures_measurement_check");
  assert.equal(JSON.stringify(logs).includes("do not log database message"), false);
});

test("failure logging is best-effort and cannot mask a READY repository rejection", async () => {
  const repositoryError = Object.assign(new Error("repository failure marker"), { code: "23514" });
  const { service } = makeObservationPipeline({ failReady: repositoryError });
  const originalLog = Logger.prototype.log;
  const originalError = Logger.prototype.error;
  let failedEventAttempted = 0;
  Logger.prototype.log = () => undefined;
  Logger.prototype.error = () => {
    failedEventAttempted += 1;
    throw new Error("logger failure marker");
  };
  try {
    await assert.rejects(service.submitCaptureObservation({ tenantId: "tenant-1", terminalDeviceId: "device-1", credentialId: "credential-1" }, {
      captureId: "40000000-0000-4000-8000-000000000001", deviceId: "scale-1", weight: 0.245,
      unit: "kg", source: "REAL", unitVerified: true, observedAt: new Date().toISOString(),
    }), (error: unknown) => error === repositoryError);
  } finally {
    Logger.prototype.log = originalLog;
    Logger.prototype.error = originalError;
  }
  assert.equal(failedEventAttempted, 1);
});

test("failure logger errors never replace the original READY repository exception", async () => {
  const repositoryError = Object.assign(new Error("repository failure marker"), { code: "23514" });
  const { service } = makeObservationPipeline({ failReady: repositoryError });
  const originalLog = Logger.prototype.log;
  const originalError = Logger.prototype.error;
  let failureLogAttempts = 0;
  Logger.prototype.log = () => undefined;
  Logger.prototype.error = () => {
    failureLogAttempts += 1;
    throw new Error("logger failure marker");
  };
  try {
    await assert.rejects(service.submitCaptureObservation({ tenantId: "tenant-1", terminalDeviceId: "device-1", credentialId: "credential-1" }, {
      captureId: "40000000-0000-4000-8000-000000000001", deviceId: "scale-1", weight: 0.245,
      unit: "kg", source: "REAL", unitVerified: true, observedAt: new Date().toISOString(),
    }), (error: unknown) => error === repositoryError);
  } finally {
    Logger.prototype.log = originalLog;
    Logger.prototype.error = originalError;
  }
  assert.equal(failureLogAttempts, 1);
});

test("observation controller logs receipt and authenticated stage without request secrets or weight", async () => {
  const service = {
    authenticateAgent: async () => ({ tenantId: "tenant-1", terminalDeviceId: "device-1",
      credentialId: "credential-safe-test", credentialSecret: "authorization-secret-marker" }),
    submitCaptureObservation: async () => ({ status: "READY" }),
  } as never;
  const controller = new ScaleAuthorizationPairingController(service);
  const logs = await captureObservationLogs(async () => {
    await controller.captureObservation("Agent credential.secret-marker", {
      captureId: "40000000-0000-4000-8000-000000000001", deviceId: "scale-1", weight: 987.654321,
      unit: "kg", source: "REAL", unitVerified: true, observedAt: new Date().toISOString(),
    });
  });
  assert.deepEqual(logs.map((entry) => entry.event), ["observation.received", "observation.agent_authenticated"]);
  const serialized = JSON.stringify(logs);
  for (const forbidden of ["authorization-secret-marker", "credential.secret-marker", "987.654321", "credential-safe-test"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

const withPairingSigningEnv = async (run: (signingPublicPem: string) => Promise<void>) => {
  const { generateKeyPairSync } = await import("node:crypto");
  const pair = generateKeyPairSync("ed25519");
  const names = ["AGENT_ENROLLMENT_SIGNING_KEY_ID", "AGENT_ENROLLMENT_SIGNING_PRIVATE_KEY_PEM", "AGENT_ENROLLMENT_AUDIENCE"] as const;
  const previous = names.map((name) => process.env[name]);
  process.env.AGENT_ENROLLMENT_SIGNING_KEY_ID = "qa-fixture-key";
  process.env.AGENT_ENROLLMENT_SIGNING_PRIVATE_KEY_PEM = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.AGENT_ENROLLMENT_AUDIENCE = "manus-agent:qa";
  try { await run(pair.publicKey.export({ type: "spki", format: "pem" }).toString()); } finally {
    names.forEach((name, index) => { if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index]; });
  }
};

const makePairingService = (issuedCredentialIds: Set<string>) => {
  const client = {
    query: async (sql: string) => {
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql.trim())) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM terminal_devices") && sql.includes("FOR UPDATE")) {
        return { rows: [{ id: "device-1", tenant_id: "tenant-1", installation_id: "install-1", registration_status: "ACTIVE" }], rowCount: 1 };
      }
      if (sql.includes("FROM pos_terminals")) return { rows: [{ id: "pos-1", branch_id: "branch-1", operational_terminal_id: "terminal-1" }], rowCount: 1 };
      if (sql.includes("FROM terminals")) return { rows: [{ id: "terminal-1" }], rowCount: 1 };
      if (sql.includes("FROM terminal_device_bindings")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("FROM terminal_device_credentials")) return { rows: [], rowCount: 0 };
      throw new Error(`UNEXPECTED_QUERY ${sql.trim().slice(0, 40)}`);
    },
    release: () => undefined,
  };
  const database = {
    getClient: async () => client,
    query: async () => ({ rows: [{ id: "device-1", tenant_id: "tenant-1", registration_status: "ACTIVE" }], rowCount: 1 }),
  };
  // Mirrors the terminal_device_credentials_credential_id_unique index (V103).
  const credentials = { issue: async (_client: unknown, input: { credentialId: string }) => {
    if (issuedCredentialIds.has(input.credentialId)) throw Object.assign(new Error("duplicate key"), { code: "23505" });
    issuedCredentialIds.add(input.credentialId);
    return { id: "credential-row" };
  } };
  return new ScaleAuthorizationRuntimeService(database as never, credentials as never, {} as never, {} as never);
};

test("pairing challenge from the service is backdated, bounded and single-use", async () => {
  await withPairingSigningEnv(async () => {
    const { generateKeyPairSync } = await import("node:crypto");
    const enrollmentPublicKeyPem = generateKeyPairSync("rsa", { modulusLength: 3072 }).publicKey
      .export({ type: "spki", format: "pem" }).toString();
    const service = makePairingService(new Set());
    const before = Date.now();
    const signedChallenge = await service.createPairingChallenge({ installationId: "install-1", nonce: "n".repeat(48), enrollmentPublicKeyPem });
    const after = Date.now();
    const issued = Date.parse(signedChallenge.challenge.issuedAt);
    const expires = Date.parse(signedChallenge.challenge.expiresAt);
    assert.ok(issued >= before - 2_000 && issued <= after - 2_000, "issuedAt is API now minus 2,000 ms");
    assert.equal(expires - issued, 300_000);
    const approval = { signedChallenge, pairingCode: signedChallenge.challenge.pairingCode, posTerminalId: "pos-1",
      logicalScaleId: "scale-1", enrollmentPublicKeyPem };
    const actor = { tenantId: "tenant-1", userId: "user-1" };
    const first = await service.approvePairing(approval, actor as never);
    assert.equal(first.credentialId, signedChallenge.challenge.jti);
    await assert.rejects(service.approvePairing(approval, actor as never),
      (error: unknown) => error instanceof ConflictException && (error as Error).message === "PAIRING_CHALLENGE_ALREADY_USED");
    const tampered = { ...approval, signedChallenge: { ...signedChallenge,
      challenge: { ...signedChallenge.challenge, issuedAt: new Date(issued - 1_000).toISOString() } } };
    await assert.rejects(service.approvePairing(tampered, actor as never),
      (error: unknown) => error instanceof ForbiddenException && (error as Error).message === "PAIRING_CHALLENGE_INVALID");
    await assert.rejects(service.approvePairing({ ...approval, pairingCode: "0000000000" }, actor as never), ForbiddenException);
  });
});

test("terminal snapshot exposes the latest credential ID so revocation targets it", async () => {
  const queries: { sql: string; params: unknown[] }[] = [];
  const row = {
    pos_terminal_id: "pos-1", branch_id: "branch-1", operational_terminal_id: "terminal-1",
    scale_device_id: "scale-1", enable_scale: true,
    device_id: "device-1", registration_status: "BOUND", installation_id: "install-1",
    credential_id: "credential-jti-1", credential_status: "ACTIVE", credential_expires_at: new Date(Date.now() + 60_000),
    binding_id: "binding-1", logical_scale_id: "scale-1", binding_status: "REVOKED", unit_state: "NOT_VERIFIED",
    unit_verification_method: null, unit_verification_unit: null, unit_verified_by_user_id: null, verified_at: null,
  };
  const database = { query: async (sql: string, params: unknown[]) => { queries.push({ sql, params }); return { rows: [row], rowCount: 1 }; } };
  const service = new ScaleAuthorizationRuntimeService(database as never, {} as never, {} as never, {} as never);
  const state = await service.getTerminalState("pos-1", { tenantId: "tenant-1", userId: "user-1" } as never);
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /c\.credential_id/);
  assert.deepEqual(queries[0].params, ["pos-1", "tenant-1"]);
  assert.equal(state.agent.credentialId, "credential-jti-1");
  assert.equal(state.agent.authenticated, true);
  // The latest binding may be REVOKED; the snapshot reports it as such for the UI guard.
  assert.equal(state.binding?.status, "REVOKED");
  const expired = { ...row, credential_status: "ACTIVE", credential_expires_at: new Date(Date.now() - 1_000) };
  const expiredService = new ScaleAuthorizationRuntimeService({ query: async () => ({ rows: [expired], rowCount: 1 }) } as never,
    {} as never, {} as never, {} as never);
  const expiredState = await expiredService.getTerminalState("pos-1", { tenantId: "tenant-1", userId: "user-1" } as never);
  assert.equal(expiredState.agent.credentialId, "credential-jti-1");
  assert.equal(expiredState.agent.authenticated, false);
});

// --- EXCLUSIVE_ACQUISITION_V1 observation protocol (deterministic server clock) ---

const CAPTURE_CREATED_AT = Date.parse("2026-11-18T05:42:51.410Z");
const RECEIVED_AT = CAPTURE_CREATED_AT + 1_000;
const fixedClock = (legacyPolicy: "ENABLED" | "DISABLED" | "INVALID" = "ENABLED") => ({ now: () => RECEIVED_AT, legacyPolicy: () => legacyPolicy });
const agentAuth = { tenantId: "tenant-1", terminalDeviceId: "device-1", credentialId: "credential-1" };

const makeTimedPipeline = (row: Partial<{ tenant_id: string; terminal_device_id: string; logical_scale_id: string;
  status: string; created_at: Date; expires_at: Date }> = {}, options: { credentialRows?: number; contextRows?: number } = {}) => {
  const statements: string[] = [];
  const ready: Array<{ captureId: string; observation: Record<string, unknown>; now?: Date }> = [];
  let state = row.status ?? "PENDING";
  const client = {
    query: async (sql: string) => {
      statements.push(sql.trim().split(/\s+/).slice(0, 3).join(" "));
      if (sql.includes("FROM terminal_scale_weight_captures WHERE capture_id = $1 FOR UPDATE")) return { rows: [{
        tenant_id: "tenant-1", terminal_device_id: "device-1", logical_scale_id: "scale-1",
        created_at: new Date(CAPTURE_CREATED_AT), expires_at: new Date(CAPTURE_CREATED_AT + 60_000), ...row, status: state,
      }], rowCount: 1 };
      if (sql.includes("FROM terminal_device_credentials c JOIN terminal_devices d")) {
        const count = options.credentialRows ?? 1; return { rows: Array(count).fill({}), rowCount: count };
      }
      if (sql.includes("SELECT 1 FROM terminal_scale_weight_captures c")) {
        const count = options.contextRows ?? 1; return { rows: Array(count).fill({}), rowCount: count };
      }
      return { rows: [], rowCount: 0 };
    },
    release: () => undefined,
  };
  const captures = { markReady: async (_client: unknown, input: { captureId: string; observation: Record<string, unknown>; now?: Date }) => {
    ready.push(input); state = "READY";
    return { capture_id: input.captureId, status: "READY", expires_at: new Date(CAPTURE_CREATED_AT + 60_000), weight_kg: "0.245000" };
  } };
  const service = new ScaleAuthorizationRuntimeService({ getClient: async () => client } as never,
    {} as never, {} as never, captures as never);
  return { service, statements, ready };
};

const observation = (agentWallMs: number, extra: Record<string, unknown> = {}) => ({
  captureId: "40000000-0000-4000-8000-000000000001", deviceId: "scale-1", weight: 0.245, unit: "kg", source: "REAL",
  unitVerified: true, observedAt: new Date(agentWallMs).toISOString(),
  captureProtocol: "EXCLUSIVE_ACQUISITION_V1", acquisition: { requestToFrameMs: 410, frameAgeMs: 90 }, ...extra,
});

test("V1 capture succeeds with the measured Windows/API skew (Agent wall clock 0.72 s behind created_at)", async () => {
  const { service, statements, ready } = makeTimedPipeline();
  const agentWall = CAPTURE_CREATED_AT - 720;
  const logs = await captureObservationLogs(async () => {
    const result = await service.submitCaptureObservation(agentAuth, observation(agentWall), fixedClock("DISABLED"));
    assert.equal(result.status, "READY");
  });
  assert.equal(ready.length, 1);
  // The original Agent observedAt is persisted unchanged; no artificial timestamp.
  assert.equal(ready[0].observation.observedAt, new Date(agentWall).toISOString());
  assert.equal(ready[0].now?.getTime(), RECEIVED_AT);
  assert.equal(statements.at(-1), "COMMIT");
  const validated = logs.find((entry) => entry.event === "observation.capture_state_validated");
  assert.equal(validated?.captureProtocol, "EXCLUSIVE_ACQUISITION_V1");
  assert.equal(validated?.requestToFrameMs, 410);
  assert.equal(validated?.frameAgeMs, 90);
  assert.equal(JSON.stringify(logs).includes("0.245"), false);
});

test("legacy qa.16 observation reproduces the QA rejection with an internal OBSERVATION_BEFORE_CAPTURE reason", async () => {
  const { service, statements, ready } = makeTimedPipeline();
  let thrown: unknown;
  const logs = await captureObservationLogs(async () => {
    try {
      await service.submitCaptureObservation(agentAuth, {
        captureId: "40000000-0000-4000-8000-000000000001", deviceId: "scale-1", weight: 0.245, unit: "kg", source: "REAL",
        unitVerified: true, observedAt: new Date(CAPTURE_CREATED_AT - 720).toISOString(),
      }, fixedClock("ENABLED"));
    } catch (error) { thrown = error; }
  });
  assert.ok(thrown instanceof ConflictException);
  assert.equal((thrown as ConflictException).message, "CAPTURE_NOT_PENDING_OR_EXPIRED");
  const failed = logs.find((entry) => entry.event === "observation.failed");
  assert.equal(failed?.stage, "capture_state_validation");
  assert.equal(failed?.rejectionReason, "OBSERVATION_BEFORE_CAPTURE");
  assert.equal(ready.length, 0);
  assert.equal(statements.at(-1), "ROLLBACK");
});

test("V1 keeps server-clock expiry and single use: expired, READY, CONSUMED and REJECTED captures are refused", async () => {
  const cases: Array<[Parameters<typeof makeTimedPipeline>[0], string]> = [
    [{ expires_at: new Date(RECEIVED_AT) }, "CAPTURE_EXPIRED"],
    [{ status: "READY" }, "CAPTURE_STATUS_INVALID"],
    [{ status: "CONSUMED" }, "CAPTURE_STATUS_INVALID"],
    [{ status: "REJECTED" }, "CAPTURE_STATUS_INVALID"],
  ];
  for (const [row, reason] of cases) {
    const { service, ready } = makeTimedPipeline(row);
    let thrown: unknown;
    const logs = await captureObservationLogs(async () => {
      try { await service.submitCaptureObservation(agentAuth, observation(RECEIVED_AT), fixedClock()); }
      catch (error) { thrown = error; }
    });
    assert.ok(thrown instanceof ConflictException);
    assert.equal((thrown as ConflictException).message, "CAPTURE_NOT_PENDING_OR_EXPIRED");
    assert.equal(logs.find((entry) => entry.event === "observation.failed")?.rejectionReason, reason);
    assert.equal(ready.length, 0);
  }
});

test("V1 replay of the same observation after READY is refused without a second update", async () => {
  const { service, ready } = makeTimedPipeline();
  await service.submitCaptureObservation(agentAuth, observation(RECEIVED_AT), fixedClock());
  await assert.rejects(service.submitCaptureObservation(agentAuth, observation(RECEIVED_AT), fixedClock()),
    (error: unknown) => error instanceof ConflictException && error.message === "CAPTURE_NOT_PENDING_OR_EXPIRED");
  assert.equal(ready.length, 1);
});

test("V1 keeps tenant, Agent device, scale, credential and authorized binding checks", async () => {
  for (const row of [{ tenant_id: "tenant-2" }, { terminal_device_id: "device-2" }, { logical_scale_id: "scale-2" }]) {
    const { service, ready } = makeTimedPipeline(row);
    await assert.rejects(service.submitCaptureObservation(agentAuth, observation(RECEIVED_AT), fixedClock()),
      (error: unknown) => error instanceof ForbiddenException && error.message === "CAPTURE_AGENT_CONTEXT_MISMATCH");
    assert.equal(ready.length, 0);
  }
  const revoked = makeTimedPipeline({}, { credentialRows: 0 });
  await assert.rejects(revoked.service.submitCaptureObservation(agentAuth, observation(RECEIVED_AT), fixedClock()),
    (error: unknown) => error instanceof ForbiddenException && error.message === "AGENT_CREDENTIAL_INVALID");
  const unauthorized = makeTimedPipeline({}, { contextRows: 0 });
  await assert.rejects(unauthorized.service.submitCaptureObservation(agentAuth, observation(RECEIVED_AT), fixedClock()),
    (error: unknown) => error instanceof ForbiddenException && error.message === "CAPTURE_BINDING_CONTEXT_UNAVAILABLE");
  assert.equal(revoked.ready.length + unauthorized.ready.length, 0);
});

test("V1 still rejects MOCK, non-kg, unverified and malformed evidence before opening a transaction", async () => {
  const service = new ScaleAuthorizationRuntimeService({ getClient: async () => assert.fail("no transaction expected") } as never,
    {} as never, {} as never, {} as never);
  for (const extra of [{ source: "MOCK" }, { unit: "lb" }, { unitVerified: false },
    { acquisition: { requestToFrameMs: 1 } }, { captureProtocol: "UNKNOWN" }]) {
    await assert.rejects(service.submitCaptureObservation(agentAuth, observation(RECEIVED_AT, extra), fixedClock()),
      BadRequestException);
  }
  await assert.rejects(service.submitCaptureObservation(agentAuth,
    observation(RECEIVED_AT, { acquisition: { requestToFrameMs: 1, frameAgeMs: 15_001 } }), fixedClock()),
  (error: unknown) => error instanceof ConflictException && error.message === "CAPTURE_OBSERVATION_STALE");
});

test("legacy observations are refused with CAPTURE_PROTOCOL_UNSUPPORTED once the legacy policy is disabled", async () => {
  const { service, ready } = makeTimedPipeline();
  await assert.rejects(service.submitCaptureObservation(agentAuth, {
    captureId: "40000000-0000-4000-8000-000000000001", deviceId: "scale-1", weight: 0.245, unit: "kg", source: "REAL",
    unitVerified: true, observedAt: new Date(RECEIVED_AT).toISOString(),
  }, fixedClock("DISABLED")), (error: unknown) => error instanceof ConflictException && error.message === "CAPTURE_PROTOCOL_UNSUPPORTED");
  assert.equal(ready.length, 0);
});

test("observation controller accepts the V1 fields and still rejects unknown fields", async () => {
  const received: unknown[] = [];
  const service = {
    authenticateAgent: async () => agentAuth,
    submitCaptureObservation: async (_auth: unknown, input: unknown) => { received.push(input); return { status: "READY" }; },
  } as never;
  const controller = new ScaleAuthorizationPairingController(service);
  await controller.captureObservation("Agent credential.secret", observation(RECEIVED_AT) as never);
  assert.equal(received.length, 1);
  await assert.rejects(controller.captureObservation("Agent credential.secret",
    { ...observation(RECEIVED_AT), sharedFrame: true } as never), BadRequestException);
});
