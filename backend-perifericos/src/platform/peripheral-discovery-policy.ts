import type { PeripheralsConfig } from "../shared/config/peripherals.config";

export type StartupDiscoveryConfig = Pick<
  PeripheralsConfig,
  "realAdaptersEnabled" | "discoverOnStartup"
>;

export const shouldRunStartupDiscovery = (
  config: StartupDiscoveryConfig
): boolean =>
  config.realAdaptersEnabled === true && config.discoverOnStartup === true;

export const scheduleStartupDiscovery = (
  config: StartupDiscoveryConfig,
  schedule: (operation: () => void) => void,
  discover: () => void | Promise<void>
): boolean => {
  if (!shouldRunStartupDiscovery(config)) {
    return false;
  }

  schedule(() => {
    void discover();
  });
  return true;
};
