import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { QA_AGENT_VERSION } from "./agent-version.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const electronRoot = resolve(projectRoot, "..", "desktop", "electron");
const repositoryRoot = resolve(projectRoot, "..");
const npmCliRelative = join("node_modules", "npm", "bin", "npm-cli.js");
const installerName = `ManusTerminalSetup-${QA_AGENT_VERSION}-win-x64.exe`;

const isWithin = (parent, child) => {
  const normalizedParent = `${resolve(parent).toLowerCase()}${sep}`;
  const normalizedChild = `${resolve(child).toLowerCase()}${sep}`;
  return normalizedChild.startsWith(normalizedParent);
};

const parseArgs = (args) => {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!["--node", "--go", "--source-root"].includes(key) || !args[index + 1]) {
      throw new Error("Usage: node build-windows-qa-static.mjs --node <node.exe> --go <go.exe> --source-root <repo-root>");
    }
    values[key.slice(2)] = resolve(args[++index]);
  }
  for (const key of ["node", "go", "source-root"]) {
    if (!values[key] || !isAbsolute(values[key])) throw new Error(`Missing absolute path for --${key}`);
  }
  return values;
};

export const createBuildPlan = ({ nodeExe, goExe, mirrorRoot = repositoryRoot } = {}) => {
  const root = resolve(mirrorRoot);
  const agentRoot = join(root, "backend-perifericos");
  const electronRoot = join(root, "desktop", "electron");
  const nodeToolchainRoot = dirname(resolve(nodeExe));
  const npmCli = join(nodeToolchainRoot, npmCliRelative);
  const installerPackageScript = join(agentRoot, "scripts", "package-windows-installer.mjs");
  const staticValidationScript = join(agentRoot, "scripts", "validate-windows-qa-static.mjs");
  return [
    { executable: resolve(nodeExe), cwd: electronRoot, args: [npmCli, "run", "pack:win:qa"], stage: "electron-qa" },
    { executable: resolve(nodeExe), cwd: agentRoot, args: [npmCli, "run", "package:windows-x64"], stage: "agent-qa" },
    { executable: resolve(nodeExe), cwd: agentRoot, args: [installerPackageScript], stage: "installer-package" },
    { executable: resolve(nodeExe), cwd: agentRoot, args: [staticValidationScript], stage: "static-validation" },
  ];
};

const runChecked = (executable, args, options, expectedFragment) => {
  const result = spawnSync(executable, args, {
    ...options,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${expectedFragment} failed with exit ${result.status}: ${result.stderr || result.stdout}`);
  }
  return typeof result.stdout === "string" ? result.stdout.trim() : "";
};

export const verifyToolchains = ({ nodeExe, goExe, sourceRoot, mirrorRoot = repositoryRoot }) => {
  assert.equal(process.platform, "win32", "QA Windows package must be built on Windows");
  assert.equal(process.arch, "x64", "QA Windows package must be built on x64");
  assert.equal(isAbsolute(nodeExe), true, "Node path must be absolute");
  assert.equal(isAbsolute(goExe), true, "Go path must be absolute");
  assert.equal(existsSync(nodeExe), true, `Node executable is missing: ${nodeExe}`);
  assert.equal(existsSync(goExe), true, `Go executable is missing: ${goExe}`);
  const nodeVersion = runChecked(nodeExe, ["--version"], {}, "Node version check");
  const goVersion = runChecked(goExe, ["version"], {}, "Go version check");
  assert.equal(nodeVersion, "v24.21.0", `Expected Node v24.21.0, received ${nodeVersion}`);
  assert.match(goVersion, /^go version go1\.24\.10 windows\/amd64$/);
  assert.equal(Boolean(process.env.MANUS_AGENT_ENROLLMENT_SIGNING_PUBLIC_KEY_PEM), false, "QA trust public key must not be injected by the build environment");
  assert.equal(Boolean(process.env.MANUS_AGENT_ENROLLMENT_SIGNING_KEY_ID), false, "QA trust key ID must not be injected by the build environment");
  const source = realpathSync(sourceRoot);
  const mirror = realpathSync(mirrorRoot);
  assert.notEqual(source.toLowerCase(), mirror.toLowerCase(), "build mirror must differ from source repository");
  assert.equal(isWithin(source, mirror) || isWithin(mirror, source), false, "source repository and build mirror must not contain one another");
  assert.equal(existsSync(join(mirror, ".git")), false, "isolated build mirror must not contain a Git worktree");
  const npmCli = join(dirname(nodeExe), npmCliRelative);
  assert.equal(existsSync(npmCli), true, `Node toolchain npm-cli.js is missing: ${npmCli}`);
  const goPath = `${dirname(goExe)};${process.env.PATH || ""}`;
  return { nodeVersion, goVersion, npmCli, goPath };
};

export const runQaStaticBuild = ({ nodeExe, goExe, sourceRoot, mirrorRoot = repositoryRoot, run = runChecked }) => {
  const toolchains = verifyToolchains({ nodeExe, goExe, sourceRoot, mirrorRoot });
  const root = resolve(mirrorRoot);
  const outputPath = join(root, "backend-perifericos", "dist-installer", "windows-x64", installerName);
  const reportPath = outputPath.replace(/\.exe$/i, ".build-manifest.json");
  for (const path of [outputPath, reportPath]) {
    assert.equal(existsSync(path), false, `Refusing to overwrite existing build output: ${path}`);
  }

  const plan = createBuildPlan({ nodeExe, goExe, mirrorRoot: root });
  for (const step of plan) {
    const {
      MANUS_AGENT_ENROLLMENT_SIGNING_PUBLIC_KEY_PEM,
      MANUS_AGENT_ENROLLMENT_SIGNING_KEY_ID,
      ...inheritedEnvironment
    } = process.env;
    const env = {
      ...inheritedEnvironment,
      MANUS_ENVIRONMENT: "qa",
      MANUS_AGENT_VERSION: QA_AGENT_VERSION,
      MANUS_NODE_TOOLCHAIN_ROOT: dirname(nodeExe),
      MANUS_NODE_TOOLCHAIN_SHA256: createHashSha256(nodeExe),
      MANUS_INSTALLER_OUTPUT_NAME: installerName,
      npm_config_offline: "true",
      PATH: toolchains.goPath,
    };
    console.log(`QA_STATIC_BUILD_STAGE=${step.stage}`);
    run(step.executable, step.args, { cwd: step.cwd, env, stdio: "inherit" }, step.stage);
  }
  return { outputPath, reportPath, nodeVersion: toolchains.nodeVersion, goVersion: toolchains.goVersion };
};

const createHashSha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = runQaStaticBuild({ nodeExe: args.node, goExe: args.go, sourceRoot: args["source-root"], mirrorRoot: repositoryRoot });
    console.log(JSON.stringify({ status: "STATIC_BUILD_PASS", version: QA_AGENT_VERSION, ...result }, null, 2));
  } catch (error) {
    console.error(`STATIC_BUILD_FAIL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
