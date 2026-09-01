"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAgentVersion = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const readVersionFromPackageJson = (path) => {
    if (!(0, node_fs_1.existsSync)(path)) {
        return null;
    }
    try {
        const parsed = JSON.parse((0, node_fs_1.readFileSync)(path, "utf8"));
        return typeof parsed.version === "string" && parsed.version.trim()
            ? parsed.version.trim()
            : null;
    }
    catch {
        return null;
    }
};
const resolveAgentVersion = (environment = process.env, packageJsonPaths = [
    environment.PERIPHERALS_PACKAGE_JSON_PATH ?? "",
    (0, node_path_1.join)(process.cwd(), "package.json"),
    (0, node_path_1.join)(process.cwd(), "backend-perifericos", "package.json"),
].filter(Boolean)) => {
    const envVersion = environment.PERIPHERALS_VERSION?.trim();
    if (envVersion) {
        return envVersion;
    }
    for (const path of packageJsonPaths) {
        const version = readVersionFromPackageJson(path);
        if (version) {
            return version;
        }
    }
    return "0.1.0";
};
exports.resolveAgentVersion = resolveAgentVersion;
//# sourceMappingURL=runtime-version.js.map