import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strict as assert } from "node:assert";
import test from "node:test";
import {
  FileSecureSecretStore,
  SecretCorruptError,
  SecureStorageUnavailableError,
  resolveSecureMutexHelperPath,
  type SecretProtector,
} from "../src/platform/secure-secret-store";

class MemoryProtector implements SecretProtector {
  async protect(secret: Uint8Array): Promise<Uint8Array> {
    return Uint8Array.from(secret, (value) => value ^ 0xa5);
  }
  async unprotect(value: Uint8Array): Promise<Uint8Array> {
    return Uint8Array.from(value, (entry) => entry ^ 0xa5);
  }
}

class FailingProtector extends MemoryProtector {
  public fail = false;
  override async protect(secret: Uint8Array): Promise<Uint8Array> {
    if (this.fail) throw new Error("simulated protection failure");
    return super.protect(secret);
  }
}

const withStore = async (run: (root: string, store: FileSecureSecretStore) => Promise<void>) => {
  const root = await mkdtemp(join(tmpdir(), "manus-secure-secret-test-"));
  try {
    await run(root, new FileSecureSecretStore(root, new MemoryProtector()));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

const workerPath = join(process.cwd(), "test", "secure-secret-store.worker.mjs");
const configuredMutexHelper = process.env.PERIPHERALS_SECURE_MUTEX_HELPER_PATH ?? resolveSecureMutexHelperPath();
const namedMutexTestAvailable = process.platform !== "win32"
  || (Boolean(configuredMutexHelper && existsSync(configuredMutexHelper)) && process.env.PERIPHERALS_TEST_MUTEX_DACL_AUTHORIZED === "1");

const runWorker = async (mode: string, root: string, secretId = "agent-token", value = "7") => {
  const child = spawn(process.execPath, ["--import", "tsx/esm", workerPath, mode, root, secretId, value], {
    cwd: process.cwd(),
    env: { ...process.env, PERIPHERALS_TEST_LOCK_TIMEOUT_MS: "60000" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const exit = new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
  const waitForReady = mode !== "hold-lock" ? Promise.resolve() : new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`worker did not become ready: ${stderr}`)), 5_000);
    child.stdout.on("data", (chunk) => {
      if (stdout.includes("READY\n")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  return { child, exit, waitForReady };
};

test("secure store returns null when secret is absent", async () => {
  await withStore(async (_root, store) => assert.equal(await store.get("agent-token"), null));
});

test("secure store writes and reads a secret without plaintext on disk", async () => {
  await withStore(async (root, store) => {
    const secret = Uint8Array.from([1, 2, 3, 4]);
    await store.set("agent-token", secret);
    assert.deepEqual(await store.get("agent-token"), secret);
    const raw = await readFile(join(root, "agent-token.secure.json"), "utf8");
    assert.equal(raw.includes("AQIDBA"), false);
    assert.match(raw, /DPAPI_CURRENTUSER/);
  });
});

test("rotate replaces the readable value only after persistence succeeds", async () => {
  await withStore(async (_root, store) => {
    await store.set("agent-token", Uint8Array.from([1]));
    await store.rotate("agent-token", Uint8Array.from([2]));
    assert.deepEqual(await store.get("agent-token"), Uint8Array.from([2]));
  });
});

test("failed rotation preserves the last confirmed secret", async () => {
  const root = await mkdtemp(join(tmpdir(), "manus-secure-secret-test-"));
  const protector = new FailingProtector();
  try {
    const store = new FileSecureSecretStore(root, protector);
    await store.set("agent-token", Uint8Array.from([1]));
    protector.fail = true;
    await assert.rejects(() => store.rotate("agent-token", Uint8Array.from([2])));
    protector.fail = false;
    assert.deepEqual(await store.get("agent-token"), Uint8Array.from([1]));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("delete is idempotent and removes the readable secret", async () => {
  await withStore(async (_root, store) => {
    await store.set("agent-token", Uint8Array.from([1]));
    await store.delete("agent-token");
    await store.delete("agent-token");
    assert.equal(await store.get("agent-token"), null);
  });
});

test("corrupt and unknown blobs fail closed", async () => {
  await withStore(async (root, store) => {
    const path = join(root, "agent-token.secure.json");
    await writeFile(path, JSON.stringify({ version: 99, protection: "PLAINTEXT", protectedData: "secret" }));
    await assert.rejects(() => store.get("agent-token"), SecretCorruptError);
  });
});

test("secret identifiers reject traversal", async () => {
  await withStore(async (_root, store) => {
    await assert.rejects(() => store.get("../outside"));
    await assert.rejects(() => store.set("bad/name", Uint8Array.from([1])));
  });
});

test("concurrent writes serialize per secret identifier", async () => {
  await withStore(async (_root, store) => {
    await Promise.all([
      store.set("agent-token", Uint8Array.from([1])),
      store.set("agent-token", Uint8Array.from([2])),
    ]);
    const value = await store.get("agent-token");
    assert.ok(value?.[0] === 1 || value?.[0] === 2);
  });
});

test("unsupported platform fails closed before writing", async () => {
  if (process.platform === "win32") return;
  await withStore(async (_root, store) => {
    await assert.rejects(() => store.set("agent-token", Uint8Array.from([1])), SecureStorageUnavailableError);
  });
});

test("separate Node processes serialize writes for one secret", { skip: process.platform !== "win32" || !namedMutexTestAvailable }, async () => {
  const root = await mkdtemp(join(tmpdir(), "manus-secure-secret-process-test-"));
  try {
    const workers = await Promise.all(Array.from({ length: 4 }, (_, index) => runWorker("set", root, "agent-token", String(index + 1))));
    const results = await Promise.all(workers.map((worker) => worker.exit));
    assert.deepEqual(results.map((result) => result.code), [0, 0, 0, 0], results.map((result) => result.stderr).join("\n"));
    const store = new FileSecureSecretStore(root, new MemoryProtector(), { lockTimeoutMs: 60000 });
    const value = await store.get("agent-token");
    assert.ok(value && value[0] >= 1 && value[0] <= 4);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("legacy lockfile is not the Windows authority", { skip: true }, async () => {
  const root = await mkdtemp(join(tmpdir(), "manus-secure-secret-lock-test-"));
  let worker;
  try {
    const store = new FileSecureSecretStore(root, new MemoryProtector(), { lockTimeoutMs: 200 });
    await store.set("agent-token", Uint8Array.from([9]));
    worker = await runWorker("hold-lock", root);
    await worker.waitForReady;
    await assert.rejects(() => store.rotate("agent-token", Uint8Array.from([10])), SecureStorageUnavailableError);
    worker.child.kill();
    const result = await worker.exit;
    assert.notEqual(result.code, 0);
    await assert.rejects(() => store.get("agent-token"), SecureStorageUnavailableError);
    assert.equal(await readFile(join(root, ".agent-token.lock"), "utf8").then(() => true), true);
    await unlink(join(root, ".agent-token.lock"));
    assert.deepEqual(await store.get("agent-token"), Uint8Array.from([9]));
  } finally {
    worker?.child.kill();
    await rm(root, { recursive: true, force: true });
  }
});

test("incomplete legacy lock metadata is occupied outside Windows", { skip: true }, async () => {
  const root = await mkdtemp(join(tmpdir(), "manus-secure-secret-malformed-lock-test-"));
  try {
    await writeFile(join(root, ".agent-token.lock"), "{}\n", { mode: 0o600 });
    const store = new FileSecureSecretStore(root, new MemoryProtector(), { lockTimeoutMs: 200 });
    await assert.rejects(() => store.set("agent-token", Uint8Array.from([11])), SecureStorageUnavailableError);
    assert.equal(await readFile(join(root, ".agent-token.lock"), "utf8"), "{}\n");
    assert.equal(await readFile(join(root, "agent-token.secure.json"), "utf8").catch(() => null), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
