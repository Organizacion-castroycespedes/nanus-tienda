import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  const restrictedPaths: string[] = [];
  (store as unknown as { restrictAcl: (path: string) => void }).restrictAcl = (path) => restrictedPaths.push(path);
  const secret = Buffer.from("opaque-secret-fixture", "utf8");
  await store.write("agent-credential", secret);
  assert.equal(restrictedPaths.length, 2);
  assert.equal(restrictedPaths[0], stateDir);
  assert.match(restrictedPaths[1], /secret-agent-credential\.dpapi\.json\..+\.tmp$/);
  assert.equal(secret.every((value) => value === 0), true);
  const persisted = readFileSync(join(stateDir, "secret-agent-credential.dpapi.json"), "utf8");
  assert.equal(persisted.includes("opaque-secret-fixture"), false);
  const loaded = await store.read("agent-credential");
  assert.equal(loaded?.toString("utf8"), "opaque-secret-fixture");
  loaded?.fill(0);
});

test("read does not mutate ACLs, passes protected fields to DPAPI and clears those buffers", async (context) => {
  if (process.platform !== "win32") { context.skip("Windows service storage contract"); return; }
  const stateDir = mkdtempSync(join(tmpdir(), "manus-agent-secret-read-"));
  context.after(() => rmSync(stateDir, { recursive: true, force: true }));
  const protector = new TestProtector();
  const writer = new DpapiAgentSecretStore(stateDir, protector);
  (writer as unknown as { restrictAcl: (path: string) => void }).restrictAcl = () => undefined;
  await writer.write("agent-credential", Buffer.from("existing-dpapi-credential", "utf8"));

  let unprotectCalls = 0;
  let ciphertext: Buffer | undefined;
  let entropy: Buffer | undefined;
  const readerProtector: SecretProtector = {
    protect: protector.protect.bind(protector),
    unprotect: async (protectedBytes, entropyBytes) => {
      unprotectCalls += 1;
      ciphertext = protectedBytes;
      entropy = entropyBytes;
      return protector.unprotect(protectedBytes, entropyBytes);
    },
  };
  const reader = new DpapiAgentSecretStore(stateDir, readerProtector);
  (reader as unknown as { restrictAcl: (path: string) => void }).restrictAcl = () => {
    throw new Error("READ_MUST_NOT_REQUIRE_WRITE_DAC");
  };

  const plaintext = await reader.read("agent-credential");
  assert.equal(unprotectCalls, 1);
  assert.equal(plaintext?.toString("utf8"), "existing-dpapi-credential");
  assert.equal(ciphertext?.every((value) => value === 0), true);
  assert.equal(entropy?.every((value) => value === 0), true);
  plaintext?.fill(0);
  assert.equal(plaintext?.every((value) => value === 0), true);
});

test("read rejects malformed protected records without attempting ACL changes", async (context) => {
  if (process.platform !== "win32") { context.skip("Windows service storage contract"); return; }
  const stateDir = mkdtempSync(join(tmpdir(), "manus-agent-secret-invalid-"));
  context.after(() => rmSync(stateDir, { recursive: true, force: true }));
  writeFileSync(join(stateDir, "secret-agent-credential.dpapi.json"), "not-json", "utf8");
  const store = new DpapiAgentSecretStore(stateDir, new TestProtector());
  (store as unknown as { restrictAcl: (path: string) => void }).restrictAcl = () => {
    throw new Error("READ_MUST_NOT_REQUIRE_WRITE_DAC");
  };
  await assert.rejects(store.read("agent-credential"), /AGENT_SECRET_RECORD_INVALID/);
});

test("read fails closed when DPAPI cannot unprotect a valid version 1 record", async (context) => {
  if (process.platform !== "win32") { context.skip("Windows service storage contract"); return; }
  const stateDir = mkdtempSync(join(tmpdir(), "manus-agent-secret-dpapi-fail-"));
  context.after(() => rmSync(stateDir, { recursive: true, force: true }));
  writeFileSync(join(stateDir, "secret-agent-credential.dpapi.json"), JSON.stringify({
    version: 1,
    entropy: Buffer.from("entropy").toString("base64"),
    protected: Buffer.from("ciphertext").toString("base64"),
  }), "utf8");
  const protector: SecretProtector = {
    protect: async () => { throw new Error("UNUSED_PROTECT"); },
    unprotect: async () => { throw new Error("DPAPI_OPERATION_FAILED"); },
  };
  const store = new DpapiAgentSecretStore(stateDir, protector);
  (store as unknown as { restrictAcl: (path: string) => void }).restrictAcl = () => {
    throw new Error("READ_MUST_NOT_REQUIRE_WRITE_DAC");
  };
  await assert.rejects(store.read("agent-credential"), /DPAPI_OPERATION_FAILED/);
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
