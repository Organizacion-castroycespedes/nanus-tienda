import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { validatePosManifest } from "../scripts/validate-pos-manifest.mjs";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const validateManifest = (root, manifest) => manifest.files.map((entry) => {
  const bytes = readFileSync(join(root, ...entry.path.split("/")));
  return {
    path: entry.path,
    sizeMatches: bytes.length === entry.size,
    hashMatches: sha256(bytes) === entry.sha256,
  };
});

test("Electron shell configuration is LF and stable byte input", () => {
  for (const relativePath of [
    "desktop/electron/resources/manus-shell.config.json",
    "backend-perifericos/windows-installer/assets/pos/resources/manus-shell.config.json",
  ]) {
    const bytes = readFileSync(join(repoRoot, relativePath));
    assert.equal(bytes.includes(Buffer.from([0x0d, 0x0a])), false, relativePath);
    assert.equal(bytes[bytes.length - 1], 0x0a, relativePath);
  }
});

test("manifest validation rejects a post-generation byte mutation", () => {
  const root = mkdtempSync(join(tmpdir(), "manus-pos-manifest-test-"));
  try {
    mkdirSync(join(root, "resources"), { recursive: true });
    const original = Buffer.from('{"environment":"production"}\n');
    const path = join(root, "resources", "manus-shell.config.json");
    writeFileSync(path, original);
    const manifest = {
      files: [{
        path: "resources/manus-shell.config.json",
        size: original.length,
        sha256: sha256(original),
      }],
    };
    assert.deepEqual(validateManifest(root, manifest), [{
      path: "resources/manus-shell.config.json",
      sizeMatches: true,
      hashMatches: true,
    }]);

    writeFileSync(path, Buffer.from(original.toString().replaceAll("\n", "\r\n")));
    assert.deepEqual(validateManifest(root, manifest), [{
      path: "resources/manus-shell.config.json",
      sizeMatches: false,
      hashMatches: false,
    }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("strict validation rejects a missing payload", () => {
  const root = mkdtempSync(join(tmpdir(), "manus-pos-manifest-strict-"));
  try {
    assert.throws(
      () => validatePosManifest({ payloadRoot: join(root, "missing-payload"), manifestPath: join(root, "pos-manifest.json") }),
      /missing payload directory/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("strict validation rejects a missing manifest", () => {
  const root = mkdtempSync(join(tmpdir(), "manus-pos-manifest-strict-"));
  try {
    mkdirSync(join(root, "payload"), { recursive: true });
    assert.throws(
      () => validatePosManifest({ payloadRoot: join(root, "payload"), manifestPath: join(root, "missing.json") }),
      /missing manifest/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("strict validation rejects missing, altered, and unsafe manifest entries", () => {
  const root = mkdtempSync(join(tmpdir(), "manus-pos-manifest-strict-"));
  try {
    const payloadRoot = join(root, "payload");
    const manifestPath = join(root, "pos-manifest.json");
    mkdirSync(join(payloadRoot, "resources"), { recursive: true });
    const bytes = Buffer.from("payload\n");
    writeFileSync(join(payloadRoot, "resources", "file.bin"), bytes);
    const validEntry = { path: "resources/file.bin", size: bytes.length, sha256: sha256(bytes) };
    writeFileSync(manifestPath, JSON.stringify({ files: [validEntry] }));
    assert.equal(validatePosManifest({ payloadRoot, manifestPath }).count, 1);

    writeFileSync(join(payloadRoot, "resources", "file.bin"), Buffer.from("altered\n"));
    assert.throws(() => validatePosManifest({ payloadRoot, manifestPath }), /size mismatch|SHA-256 mismatch/);

    writeFileSync(manifestPath, JSON.stringify({ files: [{ ...validEntry, path: "resources/missing.bin" }] }));
    assert.throws(() => validatePosManifest({ payloadRoot, manifestPath }), /missing payload file/);

    writeFileSync(manifestPath, JSON.stringify({ files: [{ ...validEntry, path: "../outside.bin" }] }));
    assert.throws(() => validatePosManifest({ payloadRoot, manifestPath }), /unsafe manifest path/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("real embedded payload is checked when present", (t) => {
  const payloadRoot = join(repoRoot, "backend-perifericos/windows-installer/assets/pos");
  const manifestPath = join(repoRoot, "backend-perifericos/windows-installer/assets/pos-manifest.json");
  if (!existsSync(manifestPath) || !existsSync(join(payloadRoot, "Manus POS.exe"))) {
    t.skip("Electron payload is not present in this source checkout");
    return;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const results = validateManifest(payloadRoot, manifest);
  assert.equal(results.length, 75);
  assert.equal(results.every((result) => result.sizeMatches && result.hashMatches), true);
});
