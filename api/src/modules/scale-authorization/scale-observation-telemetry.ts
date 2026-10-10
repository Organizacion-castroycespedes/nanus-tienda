import { HttpException, Logger } from "@nestjs/common";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const DIAGNOSTIC_MARKER_PATH = path.join(os.tmpdir(), "manus-api-weight-capture-telemetry-sink.json");
const DIAGNOSTIC_EVENTS = new Set([
  "weight_capture.create.received",
  "weight_capture.create.succeeded",
  "weight_capture.create.failed",
  "observation.received",
  "observation.agent_authenticated",
  "observation.capture_loaded",
  "observation.capture_state_validated",
  "observation.context_validated",
  "observation.ready_update_started",
  "observation.ready_update_completed",
  "observation.failed",
]);

type DiagnosticSinkMarker = {
  enabled?: unknown;
  diagnosticsDirectory?: unknown;
  fileName?: unknown;
};

export type ScaleCaptureDiagnosticSink = {
  append: (record: Record<string, unknown>) => void;
  flush: () => Promise<void>;
};

const pathIsWithin = (parent: string, candidate: string): boolean => {
  const relative = path.relative(parent, candidate);
  return relative === "" || (
    relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
  );
};

const safeString = (value: unknown, pattern: RegExp): string | undefined =>
  typeof value === "string" && value.length <= 128 && pattern.test(value) ? value : undefined;

const sanitizeDiagnosticRecord = (input: Record<string, unknown>): Record<string, unknown> | undefined => {
  const event = safeString(input.event, /^[a-z][a-z0-9_.]*$/);
  const stage = safeString(input.stage, /^[a-z][a-z0-9_]{0,63}$/);
  if (!event || !DIAGNOSTIC_EVENTS.has(event) || !stage) return undefined;

  const result: Record<string, unknown> = { event, stage, timestamp: new Date().toISOString() };
  const captureId = safeString(input.captureId, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  if (captureId) result.captureId = captureId;

  const errorClass = safeString(input.errorClass, /^[A-Za-z][A-Za-z0-9]*$/);
  if (errorClass) result.errorClass = errorClass;
  const errorCode = safeString(input.errorCode, /^[A-Z][A-Z0-9_]{2,95}$/);
  if (errorCode) result.errorCode = errorCode;
  const sqlState = safeString(input.sqlState, /^[0-9A-Z]{5}$/);
  if (sqlState) result.sqlState = sqlState;
  const constraint = safeString(input.constraint, /^[A-Za-z_][A-Za-z0-9_]*$/);
  if (constraint) result.constraint = constraint;

  if (typeof input.httpStatus === "number" && Number.isInteger(input.httpStatus)
    && input.httpStatus >= 100 && input.httpStatus <= 599) result.httpStatus = input.httpStatus;
  if (typeof input.found === "boolean") result.found = input.found;
  if (typeof input.unitVerified === "boolean") result.unitVerified = input.unitVerified;
  if (typeof input.stabilityVerified === "boolean") result.stabilityVerified = input.stabilityVerified;
  if (typeof input.status === "string" && /^(PENDING|READY|CONSUMED|EXPIRED|REJECTED)$/.test(input.status)) {
    result.status = input.status;
  }
  if (typeof input.source === "string" && /^(REAL|MOCK|SIMULATED|UNKNOWN)$/.test(input.source)) {
    result.source = input.source;
  }
  const unit = safeString(input.unit, /^[A-Za-z]{1,8}$/);
  if (unit) result.unit = unit;
  const logicalScaleId = safeString(input.logicalScaleId, /^[A-Za-z0-9._:-]+$/);
  if (logicalScaleId) result.logicalScaleId = logicalScaleId;
  const deviceId = safeString(input.deviceId, /^[A-Za-z0-9._:-]+$/);
  if (deviceId) result.deviceId = deviceId;

  return result;
};

const readMarker = async (
  markerPath: string,
  repositoryRoot: string,
): Promise<{ directory: string; filePath: string } | undefined> => {
  try {
    const markerInfo = await fs.lstat(markerPath);
    if (!markerInfo.isFile() || markerInfo.isSymbolicLink()) return undefined;
    const marker = JSON.parse(await fs.readFile(markerPath, "utf8")) as DiagnosticSinkMarker;
    if (marker.enabled !== true || typeof marker.diagnosticsDirectory !== "string"
      || typeof marker.fileName !== "string" || !path.isAbsolute(marker.diagnosticsDirectory)
      || marker.fileName.includes("..") || /[\\/]/.test(marker.fileName)
      || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,120}\.jsonl$/.test(marker.fileName)) return undefined;

    const directory = path.resolve(marker.diagnosticsDirectory);
    if (path.basename(directory).toLowerCase() !== "diagnostics" || pathIsWithin(repositoryRoot, directory)) {
      return undefined;
    }
    const filePath = path.resolve(directory, marker.fileName);
    if (path.dirname(filePath) !== directory || pathIsWithin(repositoryRoot, filePath)) return undefined;
    return { directory, filePath };
  } catch {
    return undefined;
  }
};

export const createScaleCaptureDiagnosticSink = (options: {
  markerPath?: string;
  repositoryRoot?: string;
} = {}): ScaleCaptureDiagnosticSink => {
  const markerPath = options.markerPath ?? DIAGNOSTIC_MARKER_PATH;
  const currentDirectory = path.resolve(process.cwd());
  const inferredRepositoryRoot = path.basename(currentDirectory).toLowerCase() === "api"
    ? path.resolve(currentDirectory, "..")
    : currentDirectory;
  const repositoryRoot = path.resolve(options.repositoryRoot ?? inferredRepositoryRoot);
  let pendingWrites: Promise<void> = Promise.resolve();

  const append = (record: Record<string, unknown>) => {
    try {
      const safeRecord = sanitizeDiagnosticRecord(record);
      if (!safeRecord) return;
      const line = `${JSON.stringify(safeRecord)}\n`;
      pendingWrites = pendingWrites.then(async () => {
        const config = await readMarker(markerPath, repositoryRoot);
        if (!config) return;
        await fs.mkdir(config.directory, { recursive: true });
        const realDirectory = await fs.realpath(config.directory);
        if (path.basename(realDirectory).toLowerCase() !== "diagnostics"
          || pathIsWithin(repositoryRoot, realDirectory)) return;
        const filePath = path.join(realDirectory, path.basename(config.filePath));
        try {
          const fileInfo = await fs.lstat(filePath);
          if (!fileInfo.isFile() || fileInfo.isSymbolicLink()) return;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") return;
        }
        await fs.appendFile(filePath, line, { encoding: "utf8", flag: "a", mode: 0o600 });
      }).catch(() => undefined);
    } catch {
      // Diagnostic persistence must never change request or error semantics.
    }
  };

  return { append, flush: async () => pendingWrites };
};

const diagnosticSink = createScaleCaptureDiagnosticSink();

type ObservationFailure = {
  errorClass: string;
  httpStatus?: number;
  errorCode?: string;
  sqlState?: string;
  constraint?: string;
};

const safeIdentifier = (value: unknown, pattern: RegExp): string | undefined =>
  typeof value === "string" && value.length <= 128 && pattern.test(value) ? value : undefined;

export const observationFailureMetadata = (error: unknown): ObservationFailure => {
  const details = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const errorClass = safeIdentifier(
    error instanceof Error ? error.constructor.name : "UnknownError",
    /^[A-Za-z][A-Za-z0-9]*$/,
  ) ?? "UnknownError";
  const sqlState = safeIdentifier(details.code, /^[0-9A-Z]{5}$/);
  const constraint = safeIdentifier(details.constraint, /^[A-Za-z_][A-Za-z0-9_]*$/);
  let candidateCode = error instanceof Error ? error.message : undefined;
  let httpStatus: number | undefined;

  if (error instanceof HttpException) {
    httpStatus = error.getStatus();
    const response = error.getResponse();
    if (response && typeof response === "object" && "message" in response) {
      const message = (response as { message?: unknown }).message;
      if (typeof message === "string") candidateCode = message;
    } else if (typeof response === "string") {
      candidateCode = response;
    }
  }

  const errorCode = safeIdentifier(candidateCode, /^[A-Z][A-Z0-9_]{2,95}$/);
  return {
    errorClass,
    ...(httpStatus === undefined ? {} : { httpStatus }),
    ...(errorCode ? { errorCode } : {}),
    ...(sqlState ? { sqlState } : {}),
    ...(constraint ? { constraint } : {}),
  };
};

export const logScaleObservationEvent = (
  logger: Logger,
  event: string,
  captureId: string | undefined,
  stage: string,
  metadata: Record<string, string | number | boolean | undefined> = {},
  sink: ScaleCaptureDiagnosticSink = diagnosticSink,
) => {
  let record: Record<string, unknown>;
  try {
    record = { event, ...(captureId ? { captureId } : {}), stage, ...metadata };
  } catch {
    // Telemetry is best-effort and must never change request or error semantics.
    return;
  }
  try { sink.append(record); } catch { /* Diagnostic sink is best-effort. */ }
  try {
    const serialized = JSON.stringify(record);
    if (event === "observation.failed" || event === "weight_capture.create.failed") logger.error(serialized);
    else logger.log(serialized);
  } catch { /* Logger failures must not change request or error semantics. */ }
};

export const logScaleObservationFailure = (
  logger: Logger,
  captureId: string | undefined,
  stage: string,
  error: unknown,
  sink: ScaleCaptureDiagnosticSink = diagnosticSink,
) => {
  try {
    logScaleObservationEvent(logger, "observation.failed", captureId, stage, observationFailureMetadata(error), sink);
  } catch {
    // Metadata extraction is also best-effort; callers must rethrow the original error.
  }
};

export const logWeightCaptureCreationFailure = (
  logger: Logger,
  captureId: string | undefined,
  stage: string,
  error: unknown,
  sink: ScaleCaptureDiagnosticSink = diagnosticSink,
) => {
  try {
    logScaleObservationEvent(
      logger,
      "weight_capture.create.failed",
      captureId,
      stage,
      observationFailureMetadata(error),
      sink,
    );
  } catch {
    // Metadata extraction is best-effort and must not replace the original error.
  }
};
