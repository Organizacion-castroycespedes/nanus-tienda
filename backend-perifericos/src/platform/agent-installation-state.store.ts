import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  AgentInstallationIdentityProvider,
  type AgentInstallationStateStore,
} from "../shared/identity/agent-installation-id";
import type { PlatformPaths } from "../shared/platform/platform-paths";
import { resolvePlatformPaths } from "./platform-paths";

const INSTALLATION_ID_FILE = "agent-installation-id";

export class FileAgentInstallationStateStore implements AgentInstallationStateStore {
  read(paths: PlatformPaths): string | null {
    const path = join(paths.stateDir, INSTALLATION_ID_FILE);
    return existsSync(path) ? readFileSync(path, "utf8") : null;
  }

  write(paths: PlatformPaths, installationId: string): void {
    mkdirSync(paths.stateDir, { recursive: true });
    writeFileSync(join(paths.stateDir, INSTALLATION_ID_FILE), `${installationId}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  }
}

let defaultProvider: AgentInstallationIdentityProvider | undefined;

export const getAgentInstallationId = (): string => {
  defaultProvider ??= new AgentInstallationIdentityProvider(
    resolvePlatformPaths(),
    new FileAgentInstallationStateStore()
  );
  return defaultProvider.getInstallationId();
};
