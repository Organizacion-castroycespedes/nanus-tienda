"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePlatformPaths = void 0;
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const resolvePlatformPaths = (platform = process.platform, environment = process.env) => {
    if (platform === "win32") {
        const sharedBase = environment.PROGRAMDATA || environment.LOCALAPPDATA || (0, node_path_1.join)((0, node_os_1.homedir)(), "AppData", "Local");
        const userBase = environment.LOCALAPPDATA || sharedBase;
        return {
            configDir: (0, node_path_1.join)(sharedBase, "Manus", "PeripheralAgent", "config"),
            stateDir: (0, node_path_1.join)(userBase, "Manus", "PeripheralAgent", "state"),
            logDir: (0, node_path_1.join)(userBase, "Manus", "PeripheralAgent", "logs"),
        };
    }
    if (platform === "darwin") {
        const base = (0, node_path_1.join)((0, node_os_1.homedir)(), "Library");
        return {
            configDir: (0, node_path_1.join)(base, "Application Support", "Manus", "PeripheralAgent"),
            stateDir: (0, node_path_1.join)(base, "Application Support", "Manus", "PeripheralAgent", "state"),
            logDir: (0, node_path_1.join)(base, "Logs", "Manus", "PeripheralAgent"),
        };
    }
    return {
        configDir: "/etc/manus-peripheral-agent",
        stateDir: "/var/lib/manus-peripheral-agent",
        logDir: "/var/log/manus-peripheral-agent",
    };
};
exports.resolvePlatformPaths = resolvePlatformPaths;
//# sourceMappingURL=platform-paths.js.map