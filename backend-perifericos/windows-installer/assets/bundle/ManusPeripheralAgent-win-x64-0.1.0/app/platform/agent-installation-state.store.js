"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgentInstallationId = exports.FileAgentInstallationStateStore = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const agent_installation_id_1 = require("../shared/identity/agent-installation-id");
const platform_paths_1 = require("./platform-paths");
const INSTALLATION_ID_FILE = "agent-installation-id";
class FileAgentInstallationStateStore {
    read(paths) {
        const path = (0, node_path_1.join)(paths.stateDir, INSTALLATION_ID_FILE);
        return (0, node_fs_1.existsSync)(path) ? (0, node_fs_1.readFileSync)(path, "utf8") : null;
    }
    write(paths, installationId) {
        (0, node_fs_1.mkdirSync)(paths.stateDir, { recursive: true });
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(paths.stateDir, INSTALLATION_ID_FILE), `${installationId}\n`, {
            encoding: "utf8",
            mode: 0o600,
        });
    }
}
exports.FileAgentInstallationStateStore = FileAgentInstallationStateStore;
let defaultProvider;
const getAgentInstallationId = () => {
    defaultProvider ??= new agent_installation_id_1.AgentInstallationIdentityProvider((0, platform_paths_1.resolvePlatformPaths)(), new FileAgentInstallationStateStore());
    return defaultProvider.getInstallationId();
};
exports.getAgentInstallationId = getAgentInstallationId;
//# sourceMappingURL=agent-installation-state.store.js.map