import { promises as fs } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";

const [, , mode, root, secretId = "agent-token", value = "7"] = process.argv;

if (mode === "hold-lock") {
  const lockPath = join(root, `.${secretId}.lock`);
  const handle = await fs.open(lockPath, "wx", 0o600);
  const metadata = {
    version: 1,
    nonce: randomBytes(16).toString("hex"),
    pid: process.pid,
    createdAt: new Date().toISOString(),
  };
  await handle.writeFile(`${JSON.stringify(metadata)}\n`, "utf8");
  await handle.sync();
  process.stdout.write("READY\n");
  await new Promise(() => {});
}

const { FileSecureSecretStore } = await import("../src/platform/secure-secret-store.ts");
class MemoryProtector {
  async protect(secret) { return Uint8Array.from(secret, (entry) => entry ^ 0xa5); }
  async unprotect(value) { return Uint8Array.from(value, (entry) => entry ^ 0xa5); }
}

const configuredTimeout = Number(process.env.PERIPHERALS_TEST_LOCK_TIMEOUT_MS);
const store = new FileSecureSecretStore(
  root,
  new MemoryProtector(),
  Number.isInteger(configuredTimeout) && configuredTimeout > 0 ? { lockTimeoutMs: configuredTimeout } : {},
);
if (mode === "set") {
  await store.set(secretId, Uint8Array.from([Number(value)]));
} else if (mode === "rotate") {
  await store.rotate(secretId, Uint8Array.from([Number(value)]));
} else if (mode === "delete") {
  await store.delete(secretId);
} else {
  throw new Error("Unsupported worker mode");
}
process.stdout.write("DONE\n");
