import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertPackagedPosVersions,
  assertPosVersionUsable,
  posPackagePath,
  readPosVersion,
  RETIRED_POS_VERSIONS,
} from "./pos-version.mjs";

test("the canonical POS version comes from the Electron package and is 0.1.1", () => {
  assert.match(posPackagePath(), /desktop[\\/]electron[\\/]package\.json$/);
  assert.equal(readPosVersion(), "0.1.1");
  assert.equal(assertPosVersionUsable(readPosVersion()), "0.1.1");
});

test("readPosVersion reads only the given repository's Electron package", (t) => {
  const root = mkdtempSync(join(tmpdir(), "manus-pos-version-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "desktop", "electron"), { recursive: true });
  writeFileSync(posPackagePath(root), JSON.stringify({ name: "fixture", version: "0.2.0" }));
  assert.equal(readPosVersion(root), "0.2.0");
});

test("the label already shipped with different bytes is retired and rejected (C-2)", () => {
  assert.deepEqual([...RETIRED_POS_VERSIONS], ["0.1.0"]);
  assert.ok(Object.isFrozen(RETIRED_POS_VERSIONS));
  assert.throws(() => assertPosVersionUsable("0.1.0"), /POS version 0\.1\.0 is retired/);
});

test("POS versions must be semantic versions", () => {
  for (const version of ["0.1.1", "0.2.0", "1.0.0", "0.1.1-qa.19"]) {
    assert.equal(assertPosVersionUsable(version), version);
  }
  for (const version of ["", "0.1", "v0.1.1", "0.01.1", "0.1.1 ", undefined, null, 11]) {
    assert.throws(() => assertPosVersionUsable(version), /semantic version/);
  }
});

test("packaged installer and POS manifests must carry the canonical POS version", () => {
  const consistent = { expected: "0.1.1", installerManifest: { posVersion: "0.1.1" }, posManifest: { posVersion: "0.1.1" } };
  assert.equal(assertPackagedPosVersions(consistent), "0.1.1");
  assert.throws(() => assertPackagedPosVersions({ ...consistent, installerManifest: { posVersion: "0.1.0" } }),
    /installer manifest posVersion 0\.1\.0 does not match POS version 0\.1\.1/);
  assert.throws(() => assertPackagedPosVersions({ ...consistent, posManifest: {} }),
    /POS manifest posVersion undefined does not match/);
  assert.throws(() => assertPackagedPosVersions({ expected: "0.1.0", installerManifest: { posVersion: "0.1.0" }, posManifest: { posVersion: "0.1.0" } }),
    /retired/);
});
