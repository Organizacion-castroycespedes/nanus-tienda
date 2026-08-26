import { randomUUID } from "node:crypto";
import type { PlatformPaths } from "../platform/platform-paths";

export type AgentInstallationStateStore = {
  read(paths: PlatformPaths): string | null;
  write(paths: PlatformPaths, installationId: string): void;
};

export class AgentInstallationIdentityProvider {
  constructor(
    private readonly paths: PlatformPaths,
    private readonly stateStore: AgentInstallationStateStore
  ) {}

  getInstallationId(): string {
    const current = this.stateStore.read(this.paths)?.trim();
    if (current) {
      return current;
    }

    const installationId = randomUUID();
    this.stateStore.write(this.paths, installationId);
    return installationId;
  }
}
