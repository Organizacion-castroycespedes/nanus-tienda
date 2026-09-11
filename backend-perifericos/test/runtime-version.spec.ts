import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveAgentVersion } from "../src/shared/runtime/runtime-version";

test("resolveAgentVersion prefers env version", () => {
  assert.equal(
    resolveAgentVersion({
      PERIPHERALS_VERSION: "9.9.9",
    } as NodeJS.ProcessEnv),
    "9.9.9"
  );
});

test("resolveAgentVersion reads package json fallback", () => {
  const root = mkdtempSync(join(tmpdir(), "manus-version-"));
  const packageJsonPath = join(root, "package.json");
  writeFileSync(
    packageJsonPath,
    JSON.stringify({
      name: "manus-version-test",
      version: "1.2.3",
    })
  );

  try {
    assert.equal(
      resolveAgentVersion(
        {
          PERIPHERALS_VERSION: "",
        } as NodeJS.ProcessEnv,
        [packageJsonPath]
      ),
      "1.2.3"
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveAgentVersion falls back to default when package json is absent", () => {
  assert.equal(
    resolveAgentVersion(
      {} as NodeJS.ProcessEnv,
      [join(tmpdir(), "missing-package-json.json")]
    ),
    "0.1.0"
  );
});
