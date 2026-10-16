import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, cpSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  assertStableElectronMetadata,
  createPackagingProvenance,
} from "../scripts/packaging-provenance.mjs";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDirectory, "..");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const writePayloadManifest = (payloadRoot, manifestPath, version = "0.1.0") => {
  const files = [];
  const executable = join(payloadRoot, "Manus POS.exe");
  const asar = join(payloadRoot, "resources", "app.asar");
  const shell = join(payloadRoot, "resources", "manus-shell.config.json");
  for (const [path, absolute] of [["Manus POS.exe", executable], ["resources/app.asar", asar], ["resources/manus-shell.config.json", shell]]) {
    const bytes = readFileSync(absolute);
    files.push({ path, size: bytes.length, sha256: sha256(bytes) });
  }
  writeFileSync(manifestPath, `${JSON.stringify({ schemaVersion: 1, posVersion: version, executable: "Manus POS.exe", shellConfig: "resources/manus-shell.config.json", payloadSize: files.reduce((sum, file) => sum + file.size, 0), files }, null, 2)}\n`);
};

test("packaging provenance accepts current release and embedded POS parity", () => {
  const electronRoot = resolve(projectRoot, "..", "desktop", "electron");
  const packageJsonPath = join(electronRoot, "package.json");
  const packageLockPath = join(electronRoot, "package-lock.json");
  const shellConfigPath = join(electronRoot, "resources", "manus-shell.config.json");
  const payloadRoot = join(electronRoot, "release", "win-unpacked");
  const embeddedPayloadRoot = join(projectRoot, "windows-installer", "assets", "pos");
  const manifestPath = join(projectRoot, "windows-installer", "assets", "pos-manifest.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const provenance = createPackagingProvenance({ packageJsonPath, packageJson, packageLockPath, shellConfigPath, payloadRoot, embeddedPayloadRoot, manifestPath });
  assert.equal(provenance.parity.releaseToEmbedded, true);
  assert.equal(provenance.parity.embeddedToManifest, true);
  assert.ok(provenance.inputs.packageJson.sha256);
  assert.ok(provenance.inputs.packageLock.sha256);
  assert.ok(provenance.inputs.shellConfig.sha256);
  assert.ok(provenance.inputs.generatedManifestSha256);
  assert.equal(provenance.sourceOfTruth.selectedReleasePayload, "desktop/electron/release/win-unpacked");
  assert.equal(provenance.sourceOfTruth.embeddedPayload, "backend-perifericos/windows-installer/assets/pos");
  assert.equal(provenance.inputs.packageJson.path, "desktop/electron/package.json");
  assert.doesNotMatch(JSON.stringify(provenance), /[A-Za-z]:\\\\\\\\|\/Users\/|\/home\//);
});

test("packaging provenance rejects allowScripts mutation", () => {
  const root = mkdtempSync(join(process.env.TEMP ?? process.cwd(), "manus-provenance-metadata-"));
  const packageJsonPath = join(root, "package.json");
  const packageLockPath = join(root, "package-lock.json");
  const shellConfigPath = join(root, "manus-shell.config.json");
  writeFileSync(packageJsonPath, JSON.stringify({ version: "0.1.0", allowScripts: { "esbuild@0.25.12": true } }));
  writeFileSync(packageLockPath, "{}");
  writeFileSync(shellConfigPath, "{}");
  assert.throws(() => assertStableElectronMetadata({ packageJsonPath, packageJson: JSON.parse(readFileSync(packageJsonPath, "utf8")), packageLockPath, shellConfigPath }), /allowScripts/);
});

test("packaging provenance rejects payload drift before installer distribution", () => {
  const root = mkdtempSync(join(process.env.TEMP ?? process.cwd(), "manus-provenance-drift-"));
  const source = join(root, "source");
  const embedded = join(root, "embedded");
  const resources = join(source, "resources");
  const embeddedResources = join(embedded, "resources");
  mkdirSync(resources, { recursive: true });
  mkdirSync(embeddedResources, { recursive: true });
  writeFileSync(join(source, "Manus POS.exe"), "exe");
  writeFileSync(join(resources, "app.asar"), "asar");
  writeFileSync(join(resources, "manus-shell.config.json"), "shell");
  cpSync(source, embedded, { recursive: true });
  const manifestPath = join(root, "pos-manifest.json");
  writePayloadManifest(source, manifestPath);
  const packageJsonPath = join(root, "package.json");
  const packageLockPath = join(root, "package-lock.json");
  const shellConfigPath = join(root, "shell-config.json");
  writeFileSync(packageJsonPath, JSON.stringify({ version: "0.1.0" }));
  writeFileSync(packageLockPath, "{}");
  writeFileSync(shellConfigPath, "shell");
  writeFileSync(join(embeddedResources, "app.asar"), "drift");
  assert.throws(() => createPackagingProvenance({ packageJsonPath, packageJson: { version: "0.1.0" }, packageLockPath, shellConfigPath, payloadRoot: source, embeddedPayloadRoot: embedded, manifestPath }), /mismatch/);
});
