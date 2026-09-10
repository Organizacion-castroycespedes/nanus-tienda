import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const installerRoot = join(root, "windows-installer");
const outputRoot = join(root, "dist-installer", "windows-x64");
const output = join(outputRoot, "ManusTerminalSetup-UI-Spike-win-x64.exe");
mkdirSync(outputRoot, { recursive: true });
execFileSync("node", [join(root, "scripts", "prepare-windows-ui-assets.mjs")], { cwd: root, stdio: "inherit", windowsHide: true });
execFileSync("go", ["build", "-trimpath", "-ldflags", "-s -w", "-o", output, "."], { cwd: installerRoot, stdio: "inherit", windowsHide: true });
console.log(`UI spike created: ${output}`);
