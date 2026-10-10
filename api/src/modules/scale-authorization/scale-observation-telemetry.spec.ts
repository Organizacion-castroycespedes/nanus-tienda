import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { Logger } from "@nestjs/common";
import {
  createScaleCaptureDiagnosticSink,
  logScaleObservationEvent,
  logScaleObservationFailure,
} from "./scale-observation-telemetry";

const captureId = "40000000-0000-4000-8000-000000000001";

const fixture = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "scale-capture-telemetry-"));
  const repositoryRoot = path.join(root, "repo");
  const diagnosticsDirectory = path.join(root, "diagnostics");
  const markerPath = path.join(root, "sink-marker.json");
  await fs.mkdir(repositoryRoot, { recursive: true });
  return { root, repositoryRoot, diagnosticsDirectory, markerPath };
};

const enableSink = async (
  markerPath: string,
  diagnosticsDirectory: string,
  fileName = "api-weight-capture.jsonl",
) => fs.writeFile(markerPath, JSON.stringify({
  enabled: true,
  diagnosticsDirectory,
  fileName,
}), "utf8");

const exists = async (target: string) => {
  try { await fs.access(target); return true; } catch { return false; }
};

const mockLogger = () => {
  const records: Array<{ level: string; value: string }> = [];
  const logger = {
    log: (value: string) => records.push({ level: "log", value }),
    error: (value: string) => records.push({ level: "error", value }),
  } as unknown as Logger;
  return { logger, records };
};

test("diagnostic sink stays disabled without an explicit marker", async (t) => {
  const state = await fixture();
  t.after(async () => fs.rm(state.root, { recursive: true, force: true }));
  const sink = createScaleCaptureDiagnosticSink({ markerPath: state.markerPath, repositoryRoot: state.repositoryRoot });

  sink.append({ event: "observation.received", captureId, stage: "request_received" });
  await sink.flush();

  assert.equal(await exists(state.diagnosticsDirectory), false);
});

test("creation and observation events share one opt-in JSONL sink", async (t) => {
  const state = await fixture();
  t.after(async () => fs.rm(state.root, { recursive: true, force: true }));
  await enableSink(state.markerPath, state.diagnosticsDirectory);
  const sink = createScaleCaptureDiagnosticSink({ markerPath: state.markerPath, repositoryRoot: state.repositoryRoot });
  const { logger, records } = mockLogger();

  logScaleObservationEvent(logger, "weight_capture.create.succeeded", captureId, "capture_created", {}, sink);
  logScaleObservationEvent(logger, "observation.ready_update_started", captureId, "ready_update", {}, sink);
  await sink.flush();

  const lines = (await fs.readFile(path.join(state.diagnosticsDirectory, "api-weight-capture.jsonl"), "utf8"))
    .trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(lines.map((line) => line.event), [
    "weight_capture.create.succeeded",
    "observation.ready_update_started",
  ]);
  assert.equal(lines[0].captureId, captureId);
  assert.match(lines[0].timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(records.length, 2);
});

test("diagnostic sink whitelists safe fields and excludes measurement and secret fields", async (t) => {
  const state = await fixture();
  t.after(async () => fs.rm(state.root, { recursive: true, force: true }));
  await enableSink(state.markerPath, state.diagnosticsDirectory);
  const sink = createScaleCaptureDiagnosticSink({ markerPath: state.markerPath, repositoryRoot: state.repositoryRoot });

  sink.append({
    event: "observation.failed",
    captureId,
    stage: "ready_update",
    errorClass: "QueryCanceledError",
    httpStatus: 500,
    errorCode: "DB_STATEMENT_TIMEOUT",
    sqlState: "57014",
    constraint: "safe_constraint_name",
    weight: 0.245,
    rawWeightKg: "0.245000",
    commercialQuantityKg: "0.245",
    Authorization: "bearer-secret-marker",
    nonce: "nonce-secret-marker",
    verifier: "verifier-secret-marker",
    secret: "credential-secret-marker",
    body: "sensitive-body-marker",
    query: "sensitive-query-marker",
    params: ["sensitive-param-marker"],
    stack: "sensitive-stack-marker",
  });
  await sink.flush();

  const output = await fs.readFile(path.join(state.diagnosticsDirectory, "api-weight-capture.jsonl"), "utf8");
  const line = JSON.parse(output);
  assert.equal(line.sqlState, "57014");
  for (const forbidden of ["0.245", "bearer-secret-marker", "nonce-secret-marker", "verifier-secret-marker",
    "credential-secret-marker", "sensitive-body-marker", "sensitive-query-marker", "sensitive-param-marker",
    "sensitive-stack-marker", "weight", "Authorization", "nonce", "verifier", "body", "query", "params", "stack"]) {
    assert.equal(output.includes(forbidden), false, `unexpected diagnostic field: ${forbidden}`);
  }
});

test("diagnostic write failure is best-effort and does not replace the observation error", async (t) => {
  const state = await fixture();
  t.after(async () => fs.rm(state.root, { recursive: true, force: true }));
  const blockedDirectory = path.join(state.root, "diagnostics");
  await fs.writeFile(blockedDirectory, "not-a-directory", "utf8");
  await enableSink(state.markerPath, blockedDirectory);
  const sink = createScaleCaptureDiagnosticSink({ markerPath: state.markerPath, repositoryRoot: state.repositoryRoot });
  const original = Object.assign(new Error("sensitive query and weight detail"), { code: "57014" });
  const { logger, records } = mockLogger();
  let caught: unknown;

  try {
    throw original;
  } catch (error) {
    caught = error;
    logScaleObservationFailure(logger, captureId, "ready_update", error, sink);
  }
  await sink.flush();

  assert.equal(caught, original);
  assert.equal(records.length, 1);
  assert.equal(JSON.parse(records[0].value).event, "observation.failed");
  assert.equal(await exists(path.join(blockedDirectory, "api-weight-capture.jsonl")), false);
});

test("sink rejects traversal names and output directories inside the repository", async (t) => {
  const state = await fixture();
  t.after(async () => fs.rm(state.root, { recursive: true, force: true }));
  const traversalMarker = path.join(state.root, "traversal-marker.json");
  await enableSink(traversalMarker, state.diagnosticsDirectory, "..\\escape.jsonl");
  const traversalSink = createScaleCaptureDiagnosticSink({ markerPath: traversalMarker, repositoryRoot: state.repositoryRoot });
  traversalSink.append({ event: "observation.received", captureId, stage: "request_received" });
  await traversalSink.flush();
  assert.equal(await exists(path.join(state.root, "escape.jsonl")), false);

  const insideRepoMarker = path.join(state.root, "inside-marker.json");
  const insideRepoDirectory = path.join(state.repositoryRoot, "diagnostics");
  await enableSink(insideRepoMarker, insideRepoDirectory);
  const insideRepoSink = createScaleCaptureDiagnosticSink({ markerPath: insideRepoMarker, repositoryRoot: state.repositoryRoot });
  insideRepoSink.append({ event: "observation.received", captureId, stage: "request_received" });
  await insideRepoSink.flush();
  assert.equal(await exists(insideRepoDirectory), false);
});
