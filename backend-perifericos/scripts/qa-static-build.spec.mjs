import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { QA_AGENT_VERSION } from "./agent-version.mjs";
import { createBuildPlan } from "./build-windows-qa-static.mjs";
import { readPosVersion } from "./pos-version.mjs";
import { inspectPeX64, validateInstallerDiscoveryGateSource, validatePackagedClosePolicy, validateQaAgentConfig, validateStaticQaPackage } from "./validate-windows-qa-static.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const electronRequire = createRequire(join(repositoryRoot, "desktop", "electron", "package.json"));
const electronAsar = electronRequire("@electron/asar");

const validConfig = () => ({
  packageProfile: "qa",
  mode: "REAL",
  enableRealAdapters: true,
  discoverOnStartup: false,
  enrollmentApiBaseUrl: "https://api.apptiendamanus.space/api",
  enrollmentAudience: "manus-agent:qa",
  enrollmentSigningPublicKeyPem: "",
  enrollmentSigningKeyId: "",
});

const minimalPeX64 = () => {
  const data = Buffer.alloc(512);
  data.write("MZ", 0, "ascii");
  data.writeUInt32LE(0x80, 0x3c);
  data.write("PE\0\0", 0x80, "binary");
  data.writeUInt16LE(0x8664, 0x84);
  data.writeUInt16LE(240, 0x94);
  data.writeUInt16LE(0x20b, 0x98);
  return data;
};

const makeStaticPackageFixture = async (configOverride = {}, { includeClosePolicy = true, installerPosVersion = readPosVersion(), posManifestVersion = installerPosVersion } = {}) => {
  const root = mkdtempSync(join(tmpdir(), "manus-qa17-static-test-"));
  const agentVersion = QA_AGENT_VERSION;
  const agentRoot = join(root, "dist-terminal", "windows-x64", `ManusPeripheralAgent-win-x64-${agentVersion}`);
  const assetsRoot = join(root, "windows-installer", "assets");
  const outputName = `ManusTerminalSetup-${agentVersion}-win-x64.exe`;
  const installerPath = join(root, "dist-installer", "windows-x64", outputName);
  const mkdir = (path) => mkdirSync(path, { recursive: true });
  const putJson = (path, value) => {
    mkdir(join(path, ".."));
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
    return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  };
  const config = { ...validConfig(), ...configOverride };
  const agentConfigBytes = putJson(join(agentRoot, "config", "agent.config.local.json"), config);
  putJson(join(agentRoot, "config", "agent.config.example.json"), config);
  putJson(join(agentRoot, "VERSION.json"), {
    agent: "manus-pos-peripheral-agent",
    version: agentVersion,
    platform: "win32",
    architecture: "x64",
    runtime: "v24.21.0",
  });
  putJson(join(assetsRoot, "bundle", `ManusPeripheralAgent-win-x64-${agentVersion}`, "config", "agent.config.local.json"), config);
  const installerManifest = {
    version: agentVersion,
    bundleDirName: `ManusPeripheralAgent-win-x64-${agentVersion}`,
    bundleRoot: `assets/bundle/ManusPeripheralAgent-win-x64-${agentVersion}`,
    serviceName: "ManusPeripheralAgent",
    serviceAccount: "NT AUTHORITY\\LocalService",
    posVersion: installerPosVersion,
  };
  const installerManifestBytes = putJson(join(assetsRoot, "manifest.json"), installerManifest);
  const shellConfig = {
    environment: "qa",
    frontendUrl: "https://www.apptiendamanus.space/login",
    allowedOrigins: ["https://www.apptiendamanus.space"],
    agentLoopbackOrigin: "http://127.0.0.1:4050",
  };
  const shellConfigBytes = putJson(join(assetsRoot, "pos", "resources", "manus-shell.config.json"), shellConfig);
  const appSourceRoot = join(root, "synthetic-app");
  mkdir(join(appSourceRoot, "dist"));
  writeFileSync(join(appSourceRoot, "dist", "main.js"), 'const closePolicy = require("./window-close-policy.js");\n');
  if (includeClosePolicy) {
    writeFileSync(join(appSourceRoot, "dist", "window-close-policy.js"), "exports.handleWindowClose = function handleWindowClose() {};\n");
  }
  const appAsarPath = join(assetsRoot, "pos", "resources", "app.asar");
  mkdir(join(appAsarPath, ".."));
  await electronAsar.createPackage(appSourceRoot, appAsarPath);
  const posFiles = [
    { path: "Manus POS.exe", data: Buffer.from("POS EXE") },
    { path: "resources/app.asar", data: readFileSync(appAsarPath) },
    { path: "resources/manus-shell.config.json", data: shellConfigBytes },
  ];
  for (const file of posFiles) {
    const path = join(assetsRoot, "pos", ...file.path.split("/"));
    mkdir(join(path, ".."));
    writeFileSync(path, file.data);
  }
  const posManifest = {
    posVersion: posManifestVersion,
    executable: "Manus POS.exe",
    payloadSize: posFiles.reduce((sum, file) => sum + file.data.length, 0),
    files: posFiles.map((file) => ({ path: file.path, size: file.data.length, sha256: createHash("sha256").update(file.data).digest("hex") })),
  };
  const posManifestBytes = putJson(join(assetsRoot, "pos-manifest.json"), posManifest);
  const runtimeUi = Buffer.from("<html>qa productive ui</html>");
  const appJs = Buffer.from("button data-action=\"discover\"");
  const discoveryGateSource = "if config.PackageProfile != \"dev\" && config.PackageProfile != \"production\" { return false }; return *config.EnableRealAdapters && *config.DiscoverOnStartup";
  mkdir(join(root, "windows-installer"));
  writeFileSync(join(root, "windows-installer", "productive_ui_windows.go"), discoveryGateSource);
  mkdir(join(assetsRoot, "ui"));
  writeFileSync(join(assetsRoot, "ui", "index.runtime.productive.html"), runtimeUi);
  writeFileSync(join(assetsRoot, "ui", "app.js"), appJs);
  mkdir(join(installerPath, ".."));
  const executable = Buffer.concat([
    minimalPeX64(),
    agentConfigBytes,
    installerManifestBytes,
    posManifestBytes,
    shellConfigBytes,
    runtimeUi,
    appJs,
    Buffer.from("discoverOnStartup"),
    Buffer.from("devices/discover"),
  ]);
  writeFileSync(installerPath, executable);
  return { root, installerPath, outputName };
};

test("QA version advances past installed qa.16, Build 08 qa.17 and frozen Build 09 qa.18", () => {
  assert.equal(QA_AGENT_VERSION, "0.1.1-qa.19");
});

test("static QA config requires real adapters, no startup discovery, and absent trust material", () => {
  assert.deepEqual(validateQaAgentConfig(validConfig()), validConfig());
  assert.throws(() => validateQaAgentConfig({ ...validConfig(), discoverOnStartup: true }), /startup discovery/);
  assert.throws(() => validateQaAgentConfig({ ...validConfig(), enrollmentSigningKeyId: "invented" }), /key ID/);
  assert.throws(() => validateQaAgentConfig({ ...validConfig(), enrollmentSigningPublicKeyPem: "fake" }), /public key/);
});

test("installer source keeps QA startup discovery locked and requires both booleans", () => {
  const source = "if config.PackageProfile != \"dev\" && config.PackageProfile != \"production\" { return false }; return *config.EnableRealAdapters && *config.DiscoverOnStartup";
  assert.equal(validateInstallerDiscoveryGateSource(source), true);
  assert.throws(() => validateInstallerDiscoveryGateSource("return *config.EnableRealAdapters"), /QA profile/);
});

test("static validator recognizes an unsigned AMD64 PE without executing it", () => {
  assert.deepEqual(inspectPeX64(minimalPeX64()), {
    machine: "AMD64",
    format: "PE32+",
    authenticode: "NOT_SIGNED",
  });
  const arm64 = minimalPeX64();
  arm64.writeUInt16LE(0xaa64, 0x84);
  assert.throws(() => inspectPeX64(arm64), /AMD64/);
});

test("static validator certifies a synthetic QA artifact and writes only a sidecar report", async (t) => {
  const fixture = await makeStaticPackageFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const result = await validateStaticQaPackage({ root: fixture.root, outputName: fixture.outputName });
  assert.equal(result.manifest.candidateId, "manus-terminal-0.1.1-qa.19-win-x64");
  assert.equal(result.manifest.agent.enableRealAdapters, true);
  assert.equal(result.manifest.agent.discoverOnStartup, false);
  assert.equal(result.manifest.enrollment.status, "BLOCKED");
  assert.equal(result.manifest.pos.manifestFiles, 3);
  assert.equal(result.manifest.staticChecks.qaUacObserverMarkerFound, false);
  assert.deepEqual(result.manifest.staticChecks.electronClosePolicy, {
    main: "/dist/main.js",
    closePolicy: "/dist/window-close-policy.js",
    resolved: true,
  });
});

test("static validator rejects an unsafe QA configuration before producing a report", async (t) => {
  const fixture = await makeStaticPackageFixture({ discoverOnStartup: true });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  await assert.rejects(validateStaticQaPackage({ root: fixture.root, outputName: fixture.outputName }), /startup discovery/);
});

test("static validator rejects an EXE containing the QA UAC observer", async (t) => {
  const fixture = await makeStaticPackageFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const original = readFileSync(fixture.installerPath);
  writeFileSync(fixture.installerPath, Buffer.concat([original, Buffer.from("qa-uac-observer")]));
  await assert.rejects(validateStaticQaPackage({ root: fixture.root, outputName: fixture.outputName }), /QA UAC observer/);
});

test("static validator rejects a POS app.asar whose main cannot resolve the close-policy module", async (t) => {
  const fixture = await makeStaticPackageFixture({}, { includeClosePolicy: false });
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  await assert.rejects(validateStaticQaPackage({ root: fixture.root, outputName: fixture.outputName }), /compiled close-policy module/);
});

test("static validator rejects the retired POS label 0.1.0 and inconsistent POS manifests", async (t) => {
  const cases = [
    // Canonical POS version still at the retired label, even with consistent manifests.
    [{ installerPosVersion: "0.1.0" }, "0.1.0", /POS version 0\.1\.0 is retired/],
    [{ posManifestVersion: "0.1.0" }, undefined, /POS manifest posVersion 0\.1\.0 does not match/],
    [{ installerPosVersion: "9.9.9", posManifestVersion: readPosVersion() }, undefined, /installer manifest posVersion 9\.9\.9 does not match/],
  ];
  for (const [options, posVersion, expected] of cases) {
    const fixture = await makeStaticPackageFixture({}, options);
    t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
    await assert.rejects(validateStaticQaPackage({ root: fixture.root, outputName: fixture.outputName, posVersion }), expected);
    assert.equal(existsSync(fixture.installerPath.replace(/\.exe$/i, ".build-manifest.json")), false);
  }
});

test("QA build plan uses package stages and static validation only", () => {
  const plan = createBuildPlan({
    nodeExe: "C:\\Toolchain\\node.exe",
    goExe: "C:\\Toolchain\\go.exe",
    mirrorRoot: "D:\\ManusQA-Build-05\\source",
  });
  assert.deepEqual(plan.map((step) => step.stage), ["electron-qa", "agent-qa", "installer-package", "static-validation"]);
  const commands = plan.flatMap((step) => step.args).join(" ").toLowerCase();
  for (const forbidden of [" inspect", " status", "/devices/discover", "validate:installer", "qa-uac-observer"]) {
    assert.equal(commands.includes(forbidden), false, `build plan contains forbidden operation: ${forbidden}`);
  }
  assert.equal(plan.every((step) => step.executable.toLowerCase().endsWith("node.exe")), true);
});
