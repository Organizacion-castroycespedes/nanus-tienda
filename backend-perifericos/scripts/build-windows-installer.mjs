import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getEnvironment } from "../../desktop/electron/scripts/environments.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const electronRoot = resolve(projectRoot, "..", "desktop", "electron");
const name = process.argv[2] ?? "qa";
const environment = getEnvironment(name);

if (environment.name === "dev") {
  throw new Error("dev does not generate an installer. Use npm run dev:local in desktop/electron.");
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (cwd, args) => {
  const result = spawnSync(npmCommand, args, {
    cwd,
    env: { ...process.env, MANUS_ENVIRONMENT: environment.name },
    stdio: "inherit",
    windowsHide: true,
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run(electronRoot, ["run", `pack:win:${environment.name}`]);
run(projectRoot, ["run", "installer:windows-x64"]);
run(projectRoot, ["run", "validate:installer:windows-x64"]);
