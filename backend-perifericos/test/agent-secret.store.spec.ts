import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DpapiAgentSecretStore, type SecretProtector } from "../src/modules/agent-security/agent-secret.store";

class TestProtector implements SecretProtector {
  async protect(plaintext: Buffer, entropy: Buffer) {
    return Buffer.from(plaintext.map((value, index) => value ^ entropy[index % entropy.length] ^ 0xa7));
  }
  async unprotect(ciphertext: Buffer, entropy: Buffer) {
    return Buffer.from(ciphertext.map((value, index) => value ^ entropy[index % entropy.length] ^ 0xa7));
  }
}

test("protected agent store persists ciphertext only and never returns secret through status metadata", async (context) => {
  if (process.platform !== "win32") { context.skip("Windows service storage contract"); return; }
  const stateDir = mkdtempSync(join(tmpdir(), "manus-agent-secret-"));
  context.after(() => rmSync(stateDir, { recursive: true, force: true }));
  const store = new DpapiAgentSecretStore(stateDir, new TestProtector());
  // ACL is separately exercised by the real Windows LocalService installation test.
  (store as unknown as { restrictAcl: (path: string) => void }).restrictAcl = () => undefined;
  const secret = Buffer.from("opaque-secret-fixture", "utf8");
  await store.write("agent-credential", secret);
  assert.equal(secret.every((value) => value === 0), true);
  const persisted = readFileSync(join(stateDir, "secret-agent-credential.dpapi.json"), "utf8");
  assert.equal(persisted.includes("opaque-secret-fixture"), false);
  const loaded = await store.read("agent-credential");
  assert.equal(loaded?.toString("utf8"), "opaque-secret-fixture");
  loaded?.fill(0);
});

test("protected store fails closed if the native protector cannot run", async (context) => {
  if (process.platform !== "win32") { context.skip("Windows service storage contract"); return; }
  const stateDir = mkdtempSync(join(tmpdir(), "manus-agent-secret-fail-"));
  context.after(() => rmSync(stateDir, { recursive: true, force: true }));
  const protector: SecretProtector = {
    protect: async () => { throw new Error("DPAPI_OPERATION_FAILED"); },
    unprotect: async () => { throw new Error("DPAPI_OPERATION_FAILED"); },
  };
  const store = new DpapiAgentSecretStore(stateDir, protector);
  (store as unknown as { restrictAcl: (path: string) => void }).restrictAcl = () => undefined;
  await assert.rejects(store.write("agent-credential", Buffer.from("secret")), /DPAPI_OPERATION_FAILED/);
});
