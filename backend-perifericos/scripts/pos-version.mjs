import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * POS labels already distributed with different payload bytes. Reusing one of them for
 * a new POS payload would recreate the C-2 `pos_label_collision`, so they are retired.
 * `0.1.0` shipped with distinct bytes in every QA candidate from 0.1.1-qa.13 to 0.1.1-qa.18.
 */
export const RETIRED_POS_VERSIONS = Object.freeze(["0.1.0"]);

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** The single source of the POS version: the Electron shell package. */
export const posPackagePath = (root = repositoryRoot) => join(root, "desktop", "electron", "package.json");

export const readPosVersion = (root = repositoryRoot) =>
  JSON.parse(readFileSync(posPackagePath(root), "utf8")).version;

export const assertPosVersionUsable = (version) => {
  if (typeof version !== "string" || !SEMVER.test(version)) {
    throw new Error(`POS version must be a semantic version; received ${String(version)}`);
  }
  if (RETIRED_POS_VERSIONS.includes(version)) {
    throw new Error(`POS version ${version} is retired: it was already distributed with different bytes (C-2)`);
  }
  return version;
};

/** Every packaged POS version reference must equal the canonical, usable POS version. */
export const assertPackagedPosVersions = ({ expected, installerManifest, posManifest }) => {
  assertPosVersionUsable(expected);
  if (installerManifest?.posVersion !== expected) {
    throw new Error(`installer manifest posVersion ${String(installerManifest?.posVersion)} does not match POS version ${expected}`);
  }
  if (posManifest?.posVersion !== expected) {
    throw new Error(`POS manifest posVersion ${String(posManifest?.posVersion)} does not match POS version ${expected}`);
  }
  return expected;
};
