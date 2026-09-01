"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentInstallationIdentityProvider = void 0;
const node_crypto_1 = require("node:crypto");
class AgentInstallationIdentityProvider {
    paths;
    stateStore;
    constructor(paths, stateStore) {
        this.paths = paths;
        this.stateStore = stateStore;
    }
    getInstallationId() {
        const current = this.stateStore.read(this.paths)?.trim();
        if (current) {
            return current;
        }
        const installationId = (0, node_crypto_1.randomUUID)();
        this.stateStore.write(this.paths, installationId);
        return installationId;
    }
}
exports.AgentInstallationIdentityProvider = AgentInstallationIdentityProvider;
//# sourceMappingURL=agent-installation-id.js.map