import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

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
