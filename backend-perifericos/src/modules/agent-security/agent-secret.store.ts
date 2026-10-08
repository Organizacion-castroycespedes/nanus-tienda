import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PlatformPaths } from "../../shared/platform/platform-paths";

export interface SecretProtector {
  protect(plaintext: Buffer, entropy: Buffer): Promise<Buffer>;
  unprotect(ciphertext: Buffer, entropy: Buffer): Promise<Buffer>;
}

const runPowerShellDpapi = (mode: "protect" | "unprotect", data: Buffer, entropy: Buffer): Promise<Buffer> => {
  if (process.platform !== "win32") return Promise.reject(new Error("DPAPI_WINDOWS_ONLY"));
  const script = "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; " +
    "$request=[Console]::In.ReadToEnd() | ConvertFrom-Json; " +
    "$data=[Convert]::FromBase64String($request.data); $entropy=[Convert]::FromBase64String($request.entropy); " +
    (mode === "protect"
      ? "$result=[Security.Cryptography.ProtectedData]::Protect($data,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser); "
      : "$result=[Security.Cryptography.ProtectedData]::Unprotect($data,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser); ") +
    "[Console]::Out.Write([Convert]::ToBase64String($result))";
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", script], { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    child.once("error", () => reject(new Error("DPAPI_PROCESS_FAILED")));
    child.once("close", (code) => {
      if (code !== 0) return reject(new Error("DPAPI_OPERATION_FAILED"));
      try { resolve(Buffer.from(Buffer.concat(chunks).toString("utf8").trim(), "base64")); }
      catch { reject(new Error("DPAPI_OUTPUT_INVALID")); }
    });
    child.stdin.end(JSON.stringify({ data: data.toString("base64"), entropy: entropy.toString("base64") }), "utf8");
  });
};

export class WindowsCurrentUserDpapiProtector implements SecretProtector {
  protect(plaintext: Buffer, entropy: Buffer) { return runPowerShellDpapi("protect", plaintext, entropy); }
  unprotect(ciphertext: Buffer, entropy: Buffer) { return runPowerShellDpapi("unprotect", ciphertext, entropy); }
}

type ProtectedRecord = { version: 1; entropy: string; protected: string };

export class DpapiAgentSecretStore {
  constructor(private readonly stateDir: string, private readonly protector: SecretProtector = new WindowsCurrentUserDpapiProtector()) {}

  private path(name: string) {
    if (!/^[a-z0-9-]{1,64}$/i.test(name)) throw new Error("AGENT_SECRET_NAME_INVALID");
    return join(this.stateDir, `secret-${name}.dpapi.json`);
  }

  private restrictAcl(path: string) {
    execFileSync("icacls.exe", [path, "/inheritance:r", "/grant:r", "*S-1-5-19:F", "*S-1-5-18:F", "*S-1-5-32-544:F"], {
      stdio: "ignore", windowsHide: true,
    });
  }

  async read(name: string): Promise<Buffer | null> {
    const path = this.path(name);
    if (!existsSync(path)) return null;
    if (process.platform !== "win32") throw new Error("DPAPI_WINDOWS_ONLY");
    try { this.restrictAcl(path); } catch { throw new Error("AGENT_SECRET_ACL_INVALID"); }
    let record: ProtectedRecord;
    try { record = JSON.parse(readFileSync(path, "utf8")) as ProtectedRecord; }
    catch { throw new Error("AGENT_SECRET_RECORD_INVALID"); }
    if (record.version !== 1 || !record.entropy || !record.protected) throw new Error("AGENT_SECRET_RECORD_INVALID");
    return this.protector.unprotect(Buffer.from(record.protected, "base64"), Buffer.from(record.entropy, "base64"));
  }

  async write(name: string, plaintext: Buffer): Promise<void> {
    if (process.platform !== "win32") throw new Error("DPAPI_WINDOWS_ONLY");
    mkdirSync(this.stateDir, { recursive: true });
    try { this.restrictAcl(this.stateDir); } catch { throw new Error("AGENT_SECRET_ACL_INVALID"); }
    const entropy = randomBytes(32);
    const protectedBytes = await this.protector.protect(plaintext, entropy);
    const path = this.path(name);
    const temporary = `${path}.${randomBytes(8).toString("hex")}.tmp`;
    try {
      writeFileSync(temporary, JSON.stringify({ version: 1, entropy: entropy.toString("base64"), protected: protectedBytes.toString("base64") }), { encoding: "utf8", mode: 0o600, flag: "wx" });
      // ACL is explicit rather than relying on inherited profile ACLs. Only
      // LocalService, SYSTEM and local Administrators can read the DPAPI blob.
      this.restrictAcl(temporary);
      renameSync(temporary, path);
    } catch (error) {
      try { rmSync(temporary, { force: true }); } catch { /* best effort */ }
      throw error;
    } finally {
      plaintext.fill(0);
      entropy.fill(0);
      protectedBytes.fill(0);
    }
  }

  delete(name: string): void { rmSync(this.path(name), { force: true }); }
}

export const createAgentSecretStore = (stateDir: string) => new DpapiAgentSecretStore(stateDir);

export const agentSecretStorePaths = (paths: PlatformPaths) => ({ stateDir: paths.stateDir });
