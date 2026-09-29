import type { RuntimeCompatibility } from "../peripherals/runtime-contract";
import { resolveTerminalRuntime } from "./cloud-runtime";
import { collectLocalRuntime } from "./local-runtime";
import type {
  LocalRuntimeSnapshot,
  ReadinessReason,
  TerminalReadinessResult,
  TerminalRuntimeResolution,
} from "./contracts";

export type EvaluationInput = {
  authenticated: boolean;
  posTerminalId?: string | null;
};

const makeResult = (
  local: LocalRuntimeSnapshot,
  input: EvaluationInput,
  state: TerminalReadinessResult["state"],
  reason: ReadinessReason,
  canEnterPos: boolean,
  cloudReachable = false,
  terminalId: string | null = null,
  branchId: string | null = null,
  resolution: TerminalReadinessResult["resolution"] = "NOT_RESOLVED",
): TerminalReadinessResult => ({
  resolution,
  mode: local.mode,
  state,
  reason,
  canEnterPos,
  localRuntime: local,
  agent: local.agent,
  cloud: { reachable: cloudReachable, authenticated: input.authenticated },
  device: { status: terminalId ? "BOUND" : null },
  terminal: {
    terminalId,
    branchId,
    active: terminalId ? true : null,
  },
});

const mapIncompatibility = (value: RuntimeCompatibility): ReadinessReason => {
  if (
    value.info?.agentApiVersion !== null &&
    value.info?.agentApiVersion !== undefined &&
    value.info.agentApiVersion !== 1
  ) {
    return "AGENT_API_UNSUPPORTED";
  }
  if (value.reason === "UNSUPPORTED_CONTRACT") return "BRIDGE_CONTRACT_UNSUPPORTED";
  if (value.reason === "INVALID_METADATA") return "METADATA_INVALID";
  return "BRIDGE_UNAVAILABLE";
};

const mapResolution = (
  local: LocalRuntimeSnapshot,
  input: EvaluationInput,
  resolution: TerminalRuntimeResolution,
  cloudReachable: boolean,
): TerminalReadinessResult => {
  if (resolution.resolution !== "CONFIGURED") {
    return makeResult(
      local,
      input,
      "NOT_CONFIGURED",
      resolution.resolution,
      false,
      cloudReachable,
      null,
      null,
      resolution.resolution,
    );
  }
  if (
    input.posTerminalId &&
    input.posTerminalId !== resolution.terminal.terminalId
  ) {
    return makeResult(
      local,
      input,
      "NOT_CONFIGURED",
      "TERMINAL_CONTEXT_MISMATCH",
      false,
      cloudReachable,
      resolution.terminal.terminalId,
      resolution.terminal.branchId,
      "CONFIGURED",
    );
  }
  return makeResult(
    local,
    input,
    "READY",
    "READY",
    true,
    cloudReachable,
    resolution.terminal.terminalId,
    resolution.terminal.branchId,
    "CONFIGURED",
  );
};

export class TerminalReadinessOrchestrator {
  private volatileInstallationId: string | null = null;

  async evaluate(input: EvaluationInput): Promise<TerminalReadinessResult> {
    const probe = await collectLocalRuntime();
    const { snapshot, compatibility, installationId } = probe;

    if (snapshot.mode === "WEB") {
      return makeResult(
        snapshot,
        input,
        input.authenticated ? "READY" : "BOOTING",
        input.authenticated ? "READY" : "AUTH_REQUIRED",
        input.authenticated,
      );
    }
    if (compatibility?.state === "INCOMPATIBLE") {
      return makeResult(
        snapshot,
        input,
        "INCOMPATIBLE",
        mapIncompatibility(compatibility),
        false,
      );
    }
    if (!input.authenticated) {
      return makeResult(snapshot, input, "BOOTING", "AUTH_REQUIRED", false);
    }

    if (installationId) this.volatileInstallationId = installationId;
    const identity = installationId ?? this.volatileInstallationId;
    if (!identity) {
      return makeResult(
        snapshot,
        input,
        snapshot.agent.reachable ? "NOT_CONFIGURED" : "DEGRADED",
        snapshot.agent.reachable
          ? "INSTALLATION_ID_UNAVAILABLE"
          : "AGENT_UNAVAILABLE",
        false,
      );
    }

    let resolution: TerminalRuntimeResolution;
    try {
      resolution = await resolveTerminalRuntime(identity);
    } catch {
      return makeResult(
        snapshot,
        input,
        "CLOUD_UNAVAILABLE",
        "CLOUD_UNAVAILABLE",
        false,
      );
    }

    const result = mapResolution(snapshot, input, resolution, true);
    if (!snapshot.agent.reachable && result.state === "READY") {
      return { ...result, state: "DEGRADED", reason: "AGENT_UNAVAILABLE" };
    }
    if (compatibility?.reason === "AGENT_UNKNOWN" && result.state === "READY") {
      return { ...result, state: "DEGRADED", reason: "AGENT_API_UNKNOWN", canEnterPos: false };
    }
    return result;
  }

  refresh(input: EvaluationInput) {
    return this.evaluate(input);
  }
}

export const createTerminalReadinessOrchestrator = () =>
  new TerminalReadinessOrchestrator();
