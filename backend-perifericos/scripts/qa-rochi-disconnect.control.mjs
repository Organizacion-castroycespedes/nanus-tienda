import readline from "node:readline";

export const MAX_PHASE_TIMEOUT_MS = 10_000;
export const MAX_GLOBAL_DURATION_MS = 60_000;
export const DEFAULT_GLOBAL_DURATION_MS = 60_000;

export class QaControlError extends Error {
  constructor(code, message, stage) {
    super(message);
    this.name = "QaControlError";
    this.code = code;
    this.stage = stage;
  }
}

export const createQaControl = ({
  input,
  output,
  phaseTimeoutMs = MAX_PHASE_TIMEOUT_MS,
  maxDurationMs = DEFAULT_GLOBAL_DURATION_MS,
} = {}) => {
  const boundedPhaseTimeoutMs = Math.min(phaseTimeoutMs, MAX_PHASE_TIMEOUT_MS);
  const boundedDurationMs = Math.min(maxDurationMs, MAX_GLOBAL_DURATION_MS);
  const deadline = Date.now() + boundedDurationMs;
  let activeInterface;
  let activeCancel;
  let cancelled = false;

  const remainingMs = () => Math.max(0, deadline - Date.now());

  const cancel = () => {
    cancelled = true;
    activeCancel?.(new QaControlError("CANCELLED", "QA cancelled by operator", "signal"));
    activeInterface?.close();
  };

  const confirm = (message, stage) => {
    if (cancelled) {
      return Promise.reject(new QaControlError("CANCELLED", "QA cancelled by operator", stage));
    }
    const timeoutMs = Math.min(boundedPhaseTimeoutMs, remainingMs());
    if (timeoutMs <= 0) {
      return Promise.reject(new QaControlError("TIMEOUT", "QA global duration expired", stage));
    }

    return new Promise((resolve, reject) => {
      const prompt = readline.createInterface({ input, output });
      let settled = false;
      const finish = (callback, value) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        if (activeInterface === prompt) {
          activeInterface = undefined;
          activeCancel = undefined;
        }
        prompt.close();
        callback(value);
      };
      const finishResolve = (value) => finish(resolve, value);
      const finishReject = (error) => finish(reject, error);
      const timer = setTimeout(() => {
        finishReject(new QaControlError("TIMEOUT", `Confirmation timed out after ${timeoutMs} ms`, stage));
      }, timeoutMs);

      activeInterface = prompt;
      activeCancel = finishReject;
      output.write(`${message}\nType the exact confirmation: `);
      prompt.on("line", (answer) => {
        if (answer.trim() === "YES") {
          finishResolve(true);
          return;
        }
        finishReject(new QaControlError("INVALID_CONFIRMATION", "Operator confirmation must be YES", stage));
      });
      prompt.on("close", () => {
        if (settled) {
          return;
        }
        finishReject(
          cancelled
            ? new QaControlError("CANCELLED", "QA cancelled by operator", stage)
            : new QaControlError("EOF", "Operator input ended before confirmation", stage)
        );
      });
    });
  };

  const delay = (durationMs, stage) => {
    if (cancelled) {
      return Promise.reject(new QaControlError("CANCELLED", "QA cancelled by operator", stage));
    }
    const remaining = remainingMs();
    const timeoutMs = Math.min(durationMs, remaining);
    if (timeoutMs <= 0) {
      return Promise.reject(new QaControlError("TIMEOUT", "QA global duration expired", stage));
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        if (activeCancel === cancelDelay) {
          activeCancel = undefined;
        }
        callback(value);
      };
      const cancelDelay = (error) => finish(reject, error);
      const timer = setTimeout(
        () =>
          finish(
            remaining < durationMs ? reject : resolve,
            remaining < durationMs
              ? new QaControlError("TIMEOUT", "QA global duration expired", stage)
              : undefined
          ),
        timeoutMs
      );
      activeCancel = cancelDelay;
    });
  };

  const dispose = () => {
    activeCancel = undefined;
    activeInterface?.close();
    activeInterface = undefined;
  };

  return { cancel, confirm, delay, dispose, remainingMs };
};
