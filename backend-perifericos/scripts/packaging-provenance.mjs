import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { validatePosManifest } from "./validate-pos-manifest.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const defaultLogicalPaths = Object.freeze({
  packageJson: "desktop/electron/package.json",
  packageLock: "desktop/electron/package-lock.json",
  shellConfig: "desktop/electron/resources/manus-shell.config.json",
  selectedReleasePayload: "desktop/electron/release/win-unpacked",
  embeddedPayload: "backend-perifericos/windows-installer/assets/pos",
  generatedManifest: "backend-perifericos/windows-installer/assets/pos-manifest.json",
});

export const sha256File = (path) => sha256(readFileSync(path));

export const snapshotPayload = (payloadRoot) => {
  const root = resolve(payloadRoot);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`Missing packaging payload root: ${root}`);
  }
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.isFile()) {
        const bytes = readFileSync(absolute);
        files.push({
          path: relative(root, absolute).replaceAll("\\", "/"),
          size: bytes.length,
          sha256: sha256(bytes),
        });
      } else {
        throw new Error(`Unsupported packaging payload entry: ${absolute}`);
      }
    }
  };
  visit(root);
  return files;
};

export const assertStableElectronMetadata = ({ packageJsonPath, packageJson, packageLockPath, shellConfigPath, logicalPaths = {} }) => {
  if (packageJson && Object.hasOwn(packageJson, "allowScripts")) {
    throw new Error(`Unexpected build metadata mutation: ${packageJsonPath}.allowScripts`);
  }
  for (const path of [packageJsonPath, packageLockPath, shellConfigPath]) {
    if (!existsSync(path) || !statSync(path).isFile()) {
      throw new Error(`Missing packaging input: ${path}`);
    }
  }
  const stablePaths = { ...defaultLogicalPaths, ...logicalPaths };
  return {
    packageJson: { path: stablePaths.packageJson, sha256: sha256File(packageJsonPath) },
    packageLock: { path: stablePaths.packageLock, sha256: sha256File(packageLockPath) },
    shellConfig: { path: stablePaths.shellConfig, sha256: sha256File(shellConfigPath) },
  };
};

export const createPackagingProvenance = ({
  packageJsonPath,
  packageJson,
  packageLockPath,
  shellConfigPath,
  payloadRoot,
  embeddedPayloadRoot,
  manifestPath,
  installerPath,
  logicalPaths = {},
}) => {
  const stablePaths = { ...defaultLogicalPaths, ...logicalPaths };
  const inputs = assertStableElectronMetadata({ packageJsonPath, packageJson, packageLockPath, shellConfigPath, logicalPaths: stablePaths });
  const sourcePayload = snapshotPayload(payloadRoot);
  const embeddedPayload = snapshotPayload(embeddedPayloadRoot);
  const embeddedByPath = new Map(embeddedPayload.map((file) => [file.path, file]));
  if (sourcePayload.length !== embeddedPayload.length || sourcePayload.some((file) => JSON.stringify(file) !== JSON.stringify(embeddedByPath.get(file.path)))) {
    throw new Error("POS packaging provenance mismatch: embedded payload differs from selected release payload");
  }
  const manifest = validatePosManifest({ payloadRoot: embeddedPayloadRoot, manifestPath });
  const manifestByPath = new Map(manifest.results.map((file) => [file.path, file]));
  if (manifest.results.length !== sourcePayload.length || sourcePayload.some((file) => JSON.stringify(file) !== JSON.stringify(manifestByPath.get(file.path)))) {
    throw new Error("POS packaging provenance mismatch: generated manifest differs from embedded payload");
  }
  const provenance = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceOfTruth: {
      electronSource: "desktop/electron",
      selectedReleasePayload: stablePaths.selectedReleasePayload,
      embeddedPayload: stablePaths.embeddedPayload,
      generatedManifest: stablePaths.generatedManifest,
    },
    inputs: {
      ...inputs,
      posPackageVersion: packageJson.version,
      payloadFileCount: sourcePayload.length,
      payloadSnapshotSha256: sha256(Buffer.from(JSON.stringify(sourcePayload))),
      generatedManifestSha256: sha256File(manifestPath),
    },
    parity: {
      releaseToEmbedded: true,
      embeddedToManifest: true,
      fileCount: sourcePayload.length,
      files: sourcePayload,
    },
  };
  if (installerPath && existsSync(installerPath)) {
    provenance.installer = {
      size: statSync(installerPath).size,
      sha256: sha256File(installerPath),
    };
  }
  provenance.provenanceSha256 = sha256(Buffer.from(JSON.stringify(provenance)));
  return provenance;
};

export const writePackagingProvenance = (path, provenance) => {
  writeFileSync(path, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");
};
