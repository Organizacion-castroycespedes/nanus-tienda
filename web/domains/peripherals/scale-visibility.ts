import type { PosTerminalFeatureFlags, PosTerminalResolvedConfig } from "./types";

export type PosScaleUiState =
  | "loading"
  | "unconfigured"
  | "configured"
  | "error";

type PosScaleConfig = Pick<
  PosTerminalResolvedConfig,
  "source" | "scaleDeviceId" | "scale"
> & {
  features: Pick<PosTerminalFeatureFlags, "scale">;
};

export const resolvePosScaleUiState = (
  config: PosScaleConfig | null | undefined
): Exclude<PosScaleUiState, "loading" | "error"> => {
  const deviceId = config?.scaleDeviceId?.trim();
  const scale = config?.scale;

  if (!deviceId || !scale) {
    return "unconfigured";
  }

  if (
    scale.assignment !== "ASSIGNED" ||
    scale.deviceId !== deviceId ||
    scale.classification === "MOCK"
  ) {
    return "unconfigured";
  }

  if (
    config?.source === "CONFIGURED" &&
    config.features.scale === true &&
    scale.classification === "UNKNOWN"
  ) {
    return "configured";
  }

  return "unconfigured";
};
