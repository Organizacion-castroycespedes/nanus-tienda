import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getEnvironment } from "./environments.mjs";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const name = process.argv[2] ?? "qa";
const environment = getEnvironment(name);

if (environment.name === "dev") {
  throw new Error("dev is for manual Electron development. Packaged shells require HTTPS; use qa or production.");
}

const configPath = join(projectRoot, "resources", "manus-shell.config.json");
writeFileSync(
  configPath,
  `${JSON.stringify({
    environment: environment.name,
    frontendUrl: environment.frontendUrl,
    allowedOrigins: [environment.origin],
    agentLoopbackOrigin: "http://127.0.0.1:4050",
  }, null, 2)}\n`,
  "utf8",
);

console.log(`Electron shell configured for ${environment.name}: ${environment.frontendUrl}`);
