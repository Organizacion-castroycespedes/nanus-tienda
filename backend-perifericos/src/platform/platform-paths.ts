import { homedir } from "node:os";
import { join } from "node:path";
import type { PlatformPaths } from "../shared/platform/platform-paths";

export const resolvePlatformPaths = (
  platform = process.platform,
  environment = process.env
): PlatformPaths => {
  if (platform === "win32") {
    const sharedBase = environment.PROGRAMDATA || environment.LOCALAPPDATA || join(homedir(), "AppData", "Local");
    const userBase = environment.LOCALAPPDATA || sharedBase;
    return {
      configDir: join(sharedBase, "Manus", "PeripheralAgent", "config"),
      stateDir: join(userBase, "Manus", "PeripheralAgent", "state"),
      logDir: join(userBase, "Manus", "PeripheralAgent", "logs"),
    };
  }

  if (platform === "darwin") {
    const base = join(homedir(), "Library");
    return {
      configDir: join(base, "Application Support", "Manus", "PeripheralAgent"),
      stateDir: join(base, "Application Support", "Manus", "PeripheralAgent", "state"),
      logDir: join(base, "Logs", "Manus", "PeripheralAgent"),
    };
  }

  return {
    configDir: "/etc/manus-peripheral-agent",
    stateDir: "/var/lib/manus-peripheral-agent",
    logDir: "/var/log/manus-peripheral-agent",
  };
};
