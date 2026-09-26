import type { PosTerminalFeatureFlags, PosTerminalResolvedConfig } from "./types";

export type PosScaleUiState =
  | "loading"
  | "unconfigured"
  | "configured"
  | "error";

type PosScaleConfig = Pick<
  PosTerminalResolvedConfig,
  "source" | "scaleDeviceId"
> & {
  features: Pick<PosTerminalFeatureFlags, "scale">;
};

/**
 * These IDs are development fixtures, not evidence of a physical scale.
 * Keep this list explicit until the resolve-current contract exposes device
 * origin/connection type for the assigned SCALE device.
 */
export const DOCUMENTED_MOCK_SCALE_DEVICE_IDS = new Set([
  "mock-scale-001",
]);

export const resolvePosScaleUiState = (
  config: PosScaleConfig | null | undefined
): Exclude<PosScaleUiState, "loading" | "error"> => {
  const deviceId = config?.scaleDeviceId?.trim();

  if (!deviceId) {
    return "unconfigured";
  }

  if (
    config?.source === "CONFIGURED" &&
    config.features.scale === true &&
    !DOCUMENTED_MOCK_SCALE_DEVICE_IDS.has(deviceId)
  ) {
    return "configured";
  }

  return "unconfigured";
};
