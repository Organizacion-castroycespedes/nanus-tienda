import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const bundleName = `ManusPeripheralAgent-win-x64-${packageJson.version}`;
const bundleRoot = join(projectRoot, "dist-terminal", "windows-x64", bundleName);
const installerSourceRoot = join(projectRoot, "windows-installer");
const assetsRoot = join(installerSourceRoot, "assets");
const embeddedBundleRoot = join(assetsRoot, "bundle", bundleName);
const installerManifestPath = join(assetsRoot, "manifest.json");
const outputRoot = join(projectRoot, "dist-installer", "windows-x64");
const outputPath = join(outputRoot, `ManusTerminalSetup-${packageJson.version}-win-x64.exe`);

const assertBundleReady = () => {
  if (!existsSync(bundleRoot)) {
    throw new Error(`Missing Windows portable bundle: ${bundleRoot}`);
  }
};

const clearReadonlyWindows = (path) => {
  if (process.platform !== "win32") {
    return;
  }
  try {
    execFileSync("cmd.exe", ["/c", "attrib", "-R", "/S", "/D", path], {
      stdio: "ignore",
      windowsHide: true,
    });
  } catch {
    // Best effort.
  }
};

const removePath = (path) => rmSync(path, { recursive: true, force: true });

try {
  assertBundleReady();
  clearReadonlyWindows(embeddedBundleRoot);
  clearReadonlyWindows(installerManifestPath);
  clearReadonlyWindows(outputPath);
  removePath(embeddedBundleRoot);
  removePath(installerManifestPath);
  removePath(outputPath);
  mkdirSync(dirname(embeddedBundleRoot), { recursive: true });
  mkdirSync(outputRoot, { recursive: true });

  cpSync(bundleRoot, embeddedBundleRoot, { recursive: true });

  writeFileSync(
    installerManifestPath,
    `${JSON.stringify({
      version: packageJson.version,
      bundleDirName: bundleName,
      bundleRoot: `assets/bundle/${bundleName}`,
      serviceName: "ManusPeripheralAgent",
      displayName: "Manus Peripheral Agent",
      description: "Manus Peripheral Agent installer and Windows service host",
      agentName: "manus-pos-peripheral-agent",
      serviceAccount: "NT AUTHORITY\\LocalService",
      serviceArgs: ["service"],
      healthUrl: "http://127.0.0.1:4050/health",
      installRoot: `C:\\Program Files\\Manus\\PeripheralAgent`,
      programDataRoot: `C:\\ProgramData\\Manus\\PeripheralAgent`,
      configRelative: `config\\agent.config.local.json`,
      logsRelative: `logs`,
      stateRelative: `state`,
      versionFileName: "VERSION.json",
    }, null, 2)}\n`,
    "utf8",
  );

  execFileSync(
    "go",
    [
      "build",
      "-trimpath",
      "-ldflags",
      "-s -w",
      "-o",
      outputPath,
      ".",
    ],
    {
      cwd: installerSourceRoot,
      stdio: "inherit",
      windowsHide: true,
    }
  );

  console.log(`Installer created: ${outputPath}`);
  console.log(`Installer version: ${packageJson.version}`);
  console.log(`Embedded bundle: ${embeddedBundleRoot}`);
} finally {
  // Keep embedded assets in the working tree so the installer can be rebuilt
  // and inspected. The build output itself is still reproducible.
}
