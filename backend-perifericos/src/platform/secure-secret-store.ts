import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { resolvePlatformPaths } from "./platform-paths";

const BLOB_VERSION = 1;
const MAX_SECRET_BYTES = 16 * 1024;
const MAX_POWERSHELL_OUTPUT_BYTES = 256 * 1024;
const POWERSHELL_TIMEOUT_MS = 10_000;
const DEFAULT_LOCK_TIMEOUT_MS = 10_000;
const LOCK_RETRY_INTERVAL_MS = 50;
const SECRET_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const POWERSHELL = "powershell.exe";

export interface SecureSecretStore {
  get(secretId: string): Promise<Uint8Array | null>;
  set(secretId: string, secret: Uint8Array): Promise<void>;
  rotate(secretId: string, secret: Uint8Array): Promise<void>;
  delete(secretId: string): Promise<void>;
}

export interface SecretProtector {
  protect(secret: Uint8Array): Promise<Uint8Array>;
  unprotect(protectedData: Uint8Array): Promise<Uint8Array>;
}

export class SecureSecretStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SecureSecretStoreError";
  }
}

export class SecretCorruptError extends SecureSecretStoreError {
  constructor() {
    super("Secure secret blob is corrupt or unsupported");
    this.name = "SecretCorruptError";
  }
}

export class SecureStorageUnavailableError extends SecureSecretStoreError {
  constructor(message = "Secure secret storage is unavailable", options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SecureStorageUnavailableError";
  }
}

export class SecureSecretMutexAbandonedError extends SecureStorageUnavailableError {
  constructor() {
    super("Secure secret state is indeterminate after an abandoned mutex");
    this.name = "SecureSecretMutexAbandonedError";
  }
}

type SecretBlob = {
  version: 1;
  protection: "DPAPI_CURRENTUSER";
  protectedData: string;
};

type PowerShellRequest = {
  operation: "protect" | "unprotect" | "apply-acl" | "replace-file";
  data?: string;
  path?: string;
  target?: string;
};

type PowerShellResponse = {
  ok: boolean;
  data?: string;
};

type SecretLockMetadata = {
  version: 1;
  nonce: string;
  pid: number;
  createdAt: string;
};

type SecretStoreOptions = {
  lockTimeoutMs?: number;
  mutexHelperPath?: string;
};

type NamedMutexClient = {
  child: ReturnType<typeof spawn>;
  token: string;
  operationId: string;
  stdout: string;
  settled: boolean;
};

type InterprocessLock = {
  path: string;
  nonce: string;
  handle: Awaited<ReturnType<typeof fs.open>>;
  identity: { dev: number; ino: number };
};

const POWERSHELL_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class ManusDpapiNative {
  [StructLayout(LayoutKind.Sequential)]
  private struct DataBlob { public int cbData; public IntPtr pbData; }

  [DllImport("crypt32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  private static extern bool CryptProtectData(ref DataBlob input, string description, IntPtr entropy, IntPtr reserved, IntPtr prompt, uint flags, ref DataBlob output);

  [DllImport("crypt32.dll", SetLastError = true)]
  private static extern bool CryptUnprotectData(ref DataBlob input, IntPtr description, IntPtr entropy, IntPtr reserved, IntPtr prompt, uint flags, ref DataBlob output);

  [DllImport("kernel32.dll")]
  private static extern IntPtr LocalFree(IntPtr handle);

  public static byte[] Protect(byte[] value) { return Execute(value, true); }
  public static byte[] Unprotect(byte[] value) { return Execute(value, false); }

  private static byte[] Execute(byte[] value, bool protect) {
    var input = new DataBlob { cbData = value.Length, pbData = Marshal.AllocHGlobal(value.Length) };
    var output = new DataBlob();
    try {
      Marshal.Copy(value, 0, input.pbData, value.Length);
      var ok = protect
        ? CryptProtectData(ref input, "Manus Peripheral Agent secret", IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, 0, ref output)
        : CryptUnprotectData(ref input, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, 1, ref output);
      if (!ok) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      var result = new byte[output.cbData];
      Marshal.Copy(output.pbData, result, 0, output.cbData);
      return result;
    } finally {
      if (input.pbData != IntPtr.Zero) Marshal.FreeHGlobal(input.pbData);
      if (output.pbData != IntPtr.Zero) LocalFree(output.pbData);
    }
  }
}
"@
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
switch ($request.operation) {
  'protect' {
    $inputBytes = [Convert]::FromBase64String([string]$request.data)
    $outputBytes = [ManusDpapiNative]::Protect($inputBytes)
    @{ ok = $true; data = [Convert]::ToBase64String($outputBytes) } | ConvertTo-Json -Compress
    break
  }
  'unprotect' {
    $inputBytes = [Convert]::FromBase64String([string]$request.data)
    $outputBytes = [ManusDpapiNative]::Unprotect($inputBytes)
    @{ ok = $true; data = [Convert]::ToBase64String($outputBytes) } | ConvertTo-Json -Compress
    break
  }
  'apply-acl' {
    $item = Get-Item -LiteralPath ([string]$request.path)
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Reparse points are not allowed' }
    $ownerSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $grant = if ($item.PSIsContainer) { ('*' + $ownerSid + ':(OI)(CI)(M)') } else { ('*' + $ownerSid + ':(M)') }
    $system = if ($item.PSIsContainer) { '*S-1-5-18:(OI)(CI)(F)' } else { '*S-1-5-18:(F)' }
    $admins = if ($item.PSIsContainer) { '*S-1-5-32-544:(OI)(CI)(F)' } else { '*S-1-5-32-544:(F)' }
    & icacls.exe $item.FullName '/inheritance:r' '/grant:r' $grant $system $admins | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to apply restricted ACL' }
    @{ ok = $true } | ConvertTo-Json -Compress
    break
  }
  'replace-file' {
    $source = [string]$request.path
    $target = [string]$request.target
    if (Test-Path -LiteralPath $target) {
      $targetItem = Get-Item -LiteralPath $target
      if (($targetItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Reparse points are not allowed' }
      $backup = "$target.replace-backup"
      try {
        [System.IO.File]::Replace($source, $target, $backup, $true)
      } finally {
        Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue
      }
    } else {
      [System.IO.File]::Move($source, $target)
    }
    @{ ok = $true } | ConvertTo-Json -Compress
    break
  }
  default { throw 'Unsupported secure storage operation' }
}
`;

const toBase64 = (value: Uint8Array): string => Buffer.from(value).toString("base64");
const fromBase64 = (value: string): Uint8Array => Uint8Array.from(Buffer.from(value, "base64"));

const validateSecretId = (secretId: string): void => {
  if (!SECRET_ID_PATTERN.test(secretId)) {
    throw new SecureSecretStoreError("Invalid secure secret identifier");
  }
};

const validateSecret = (secret: Uint8Array): void => {
  if (!(secret instanceof Uint8Array) || secret.byteLength === 0 || secret.byteLength > MAX_SECRET_BYTES) {
    throw new SecureSecretStoreError("Invalid secure secret size");
  }
};

const runPowerShell = (request: PowerShellRequest): Promise<PowerShellResponse> => {
  if (process.platform !== "win32") {
    return Promise.reject(new SecureStorageUnavailableError("DPAPI CurrentUser requires Windows"));
  }

  return new Promise((resolve, reject) => {
    const child = spawn(
      POWERSHELL,
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", POWERSHELL_SCRIPT],
      { stdio: ["pipe", "pipe", "pipe"] }
    );
    let stdout = "";
    let outputOverflow = false;
    let settled = false;
    let timeout: NodeJS.Timeout | undefined;
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      reject(error);
    };
    const succeed = (response: PowerShellResponse): void => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolve(response);
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (Buffer.byteLength(stdout) + Buffer.byteLength(chunk) > MAX_POWERSHELL_OUTPUT_BYTES) {
        outputOverflow = true;
        child.kill();
        return;
      }
      stdout += chunk;
    });
    child.stderr.resume();
    child.once("error", (error) => fail(new SecureStorageUnavailableError(undefined, { cause: error })));
    child.once("close", (code) => {
      if (outputOverflow || code !== 0) {
        fail(new SecureStorageUnavailableError("Protected storage operation failed"));
        return;
      }
      try {
        const response = JSON.parse(stdout) as PowerShellResponse;
        if (!response.ok) throw new Error("operation rejected");
        succeed(response);
      } catch (error) {
        fail(new SecureStorageUnavailableError("Protected storage returned invalid output", { cause: error }));
      }
    });
    timeout = setTimeout(() => {
      child.kill();
      fail(new SecureStorageUnavailableError("Protected storage operation timed out"));
    }, POWERSHELL_TIMEOUT_MS);
    child.stdin.end(JSON.stringify(request));
  });
};

export class DpapiCurrentUserProtector implements SecretProtector {
  async protect(secret: Uint8Array): Promise<Uint8Array> {
    validateSecret(secret);
    const response = await runPowerShell({ operation: "protect", data: toBase64(secret) });
    if (!response.data) throw new SecureStorageUnavailableError();
    return fromBase64(response.data);
  }

  async unprotect(protectedData: Uint8Array): Promise<Uint8Array> {
    if (!(protectedData instanceof Uint8Array) || protectedData.byteLength === 0) {
      throw new SecretCorruptError();
    }
    const response = await runPowerShell({ operation: "unprotect", data: toBase64(protectedData) });
    if (!response.data) throw new SecureStorageUnavailableError();
    const secret = fromBase64(response.data);
    validateSecret(secret);
    return secret;
  }
}

export class FileSecureSecretStore implements SecureSecretStore {
  private readonly locks = new Map<string, Promise<void>>();
  private readonly lockTimeoutMs: number;
  private readonly mutexHelperPath?: string;

  constructor(
    private readonly rootDir = resolvePlatformPaths().secureSecretDir ?? join(resolvePlatformPaths().stateDir, "secrets"),
    private readonly protector: SecretProtector = new DpapiCurrentUserProtector(),
    options: SecretStoreOptions = {}
  ) {
    this.lockTimeoutMs = options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
    this.mutexHelperPath = options.mutexHelperPath;
    if (!Number.isInteger(this.lockTimeoutMs) || this.lockTimeoutMs <= 0) {
      throw new SecureSecretStoreError("Invalid secure storage lock timeout");
    }
  }

  async get(secretId: string): Promise<Uint8Array | null> {
    validateSecretId(secretId);
    return this.withLock(secretId, async () => {
      const path = this.pathFor(secretId);
      try {
        await this.assertSafePath(path);
        const raw = await fs.readFile(path, "utf8");
        const blob = this.parseBlob(raw);
        return this.protector.unprotect(fromBase64(blob.protectedData));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        if (error instanceof SecretCorruptError) throw error;
        if (error instanceof SecureSecretStoreError) throw error;
        throw new SecureStorageUnavailableError("Unable to read secure secret", { cause: error });
      }
    });
  }

  async set(secretId: string, secret: Uint8Array): Promise<void> {
    await this.write(secretId, secret);
  }

  async rotate(secretId: string, secret: Uint8Array): Promise<void> {
    await this.write(secretId, secret);
  }

  async delete(secretId: string): Promise<void> {
    validateSecretId(secretId);
    await this.withLock(secretId, async () => {
      try {
        const path = this.pathFor(secretId);
        await this.assertSafePath(path);
        await fs.unlink(path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw new SecureStorageUnavailableError("Unable to delete secure secret", { cause: error });
        }
      }
    });
  }

  private async write(secretId: string, secret: Uint8Array): Promise<void> {
    validateSecretId(secretId);
    validateSecret(secret);
    await this.withLock(secretId, async () => {
      if (process.platform !== "win32") {
        throw new SecureStorageUnavailableError("DPAPI CurrentUser requires Windows");
      }
      const path = this.pathFor(secretId);
      const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
      const protectedData = await this.protector.protect(secret);
      const blob: SecretBlob = {
        version: BLOB_VERSION,
        protection: "DPAPI_CURRENTUSER",
        protectedData: toBase64(protectedData),
      };
      await fs.mkdir(this.rootDir, { recursive: true });
      await this.assertSafeDirectory(this.rootDir);
      await this.assertSafePath(path, true);
      await runPowerShell({ operation: "apply-acl", path: this.rootDir });
      const handle = await fs.open(tempPath, "wx", 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(blob)}\n`, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      try {
        await runPowerShell({ operation: "apply-acl", path: tempPath });
        await runPowerShell({ operation: "replace-file", path: tempPath, target: path });
        await runPowerShell({ operation: "apply-acl", path });
      } catch (error) {
        await fs.rm(tempPath, { force: true }).catch(() => undefined);
        throw error;
      }
    });
  }

  private pathFor(secretId: string): string {
    return join(this.rootDir, `${secretId}.secure.json`);
  }

  private async assertSafeDirectory(directory: string): Promise<void> {
    const stat = await fs.lstat(directory);
    if (stat.isSymbolicLink()) throw new SecureStorageUnavailableError("Secure storage path is a reparse point");
    const resolved = await fs.realpath(directory);
    if (resolved.toLowerCase() !== directory.toLowerCase()) {
      throw new SecureStorageUnavailableError("Secure storage path is not canonical");
    }
  }

  private async assertSafePath(path: string, allowMissing = false): Promise<void> {
    try {
      const stat = await fs.lstat(path);
      if (stat.isSymbolicLink()) throw new SecureStorageUnavailableError("Secure storage file is a reparse point");
      const resolved = await fs.realpath(path);
      if (resolved.toLowerCase() !== path.toLowerCase()) {
        throw new SecureStorageUnavailableError("Secure storage file is not canonical");
      }
    } catch (error) {
      if (allowMissing && (error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }

  private parseBlob(raw: string): SecretBlob {
    try {
      const value = JSON.parse(raw) as Partial<SecretBlob>;
      if (value.version !== BLOB_VERSION || value.protection !== "DPAPI_CURRENTUSER" || typeof value.protectedData !== "string") {
        throw new Error("invalid blob");
      }
      const bytes = fromBase64(value.protectedData);
      if (bytes.byteLength === 0 || bytes.byteLength > 64 * 1024) throw new Error("invalid blob size");
      return { version: 1, protection: "DPAPI_CURRENTUSER", protectedData: value.protectedData };
    } catch {
      throw new SecretCorruptError();
    }
  }

  private async withLock<T>(secretId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(secretId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    const queued = previous.then(() => current);
    this.locks.set(secretId, queued);
    await previous;
    let interprocessLock: InterprocessLock | undefined;
    let namedMutex: NamedMutexClient | undefined;
    let actionFailed = false;
    try {
      if (process.platform === "win32") {
        namedMutex = await this.acquireNamedMutex(secretId);
      } else {
        interprocessLock = await this.acquireInterprocessLock(secretId);
      }
      try {
        return await action();
      } catch (error) {
        actionFailed = true;
        throw error;
      }
    } finally {
      try {
        if (namedMutex) {
          await this.releaseNamedMutex(namedMutex, actionFailed ? "ABORT" : "DONE");
        } else if (interprocessLock) {
          await this.releaseInterprocessLock(interprocessLock);
        }
      } finally {
        release();
        if (this.locks.get(secretId) === queued) this.locks.delete(secretId);
      }
    }
  }

  private async acquireNamedMutex(secretId: string): Promise<NamedMutexClient> {
    const helperPath = this.mutexHelperPath ?? resolveSecureMutexHelperPath();
    if (!helperPath) {
      throw new SecureStorageUnavailableError("Secure mutex helper path is unavailable");
    }
    const mutexName = `Local\\ManusPeripheralAgent-${createHash("sha256").update(secretId, "utf8").digest("hex")}`;
    const operationId = randomBytes(16).toString("hex");
    const child = spawn(helperPath, [
      "--secure-secret-mutex",
      "--mutex-name", mutexName,
      "--operation-id", operationId,
      "--wait-ms", String(this.lockTimeoutMs),
      "--parent-pid", String(process.pid),
    ], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let buffer = "";
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const acquired = new Promise<NamedMutexClient>((resolve, reject) => {
      const finish = (error?: Error): void => {
        if (timer) clearTimeout(timer);
        if (settled) return;
        settled = true;
        if (error) reject(error);
      };
      child.stdout!.setEncoding("utf8");
      child.stderr.resume();
      child.stdout!.on("data", (chunk: string) => {
        stdout += chunk;
        buffer += chunk;
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          const parts = line.split(/\s+/);
          if (parts[0] === "ACQUIRED" && parts[1] === operationId && parts[2]) {
            finish();
            resolve({ child, token: parts[2], operationId, stdout, settled: false });
            return;
          }
          if (parts[0] === "TIMEOUT") {
            finish(new SecureStorageUnavailableError("Secure secret mutex acquisition timed out"));
            return;
          }
          if (parts[0] === "ABANDONED") {
            finish(new SecureSecretMutexAbandonedError());
            return;
          }
          newline = buffer.indexOf("\n");
        }
      });
      child.once("error", (error) => finish(new SecureStorageUnavailableError("Secure mutex helper failed", { cause: error })));
      child.once("close", (code) => {
        if (!settled) finish(new SecureStorageUnavailableError(`Secure mutex helper exited before acquisition (${code ?? "unknown"})`));
      });
      timer = setTimeout(() => finish(new SecureStorageUnavailableError("Secure mutex acquisition timed out")), this.lockTimeoutMs + 1000);
    });
    try {
      return await acquired;
    } catch (error) {
      child.kill();
      if (stdout.includes("ABANDONED")) throw new SecureSecretMutexAbandonedError();
      throw error instanceof SecureSecretStoreError ? error : new SecureStorageUnavailableError("Secure mutex acquisition failed", { cause: error });
    }
  }

  private async releaseNamedMutex(lock: NamedMutexClient, command: "DONE" | "ABORT"): Promise<void> {
    if (lock.settled) return;
    lock.settled = true;
    const child = lock.child;
    const response = new Promise<void>((resolve, reject) => {
      let output = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new SecureStorageUnavailableError("Secure mutex release timed out"));
      }, this.lockTimeoutMs);
      child.stdout!.setEncoding("utf8");
      child.stdout!.on("data", (chunk: string) => {
        output += chunk;
        if (output.includes(`${command === "DONE" ? "RELEASED" : "ABORTED"} ${lock.operationId}`)) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(new SecureStorageUnavailableError("Secure mutex release failed", { cause: error }));
      });
      child.once("close", (code) => {
        if (!output.includes(lock.operationId)) {
          clearTimeout(timer);
          reject(new SecureStorageUnavailableError(`Secure mutex helper exited during release (${code ?? "unknown"})`));
        }
      });
    });
    child.stdin!.end(`${command} ${lock.token}\n`);
    await response;
  }

  private async acquireInterprocessLock(secretId: string): Promise<InterprocessLock> {
    await fs.mkdir(this.rootDir, { recursive: true });
    if (process.platform === "win32") {
      await runPowerShell({ operation: "apply-acl", path: this.rootDir });
    }

    const lockPath = join(this.rootDir, `.${secretId}.lock`);
    const deadline = Date.now() + this.lockTimeoutMs;
    while (true) {
      let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
      try {
        handle = await fs.open(lockPath, "wx", 0o600);
        const metadata: SecretLockMetadata = {
          version: 1,
          nonce: randomBytes(16).toString("hex"),
          pid: process.pid,
          createdAt: new Date().toISOString(),
        };
        await handle.writeFile(`${JSON.stringify(metadata)}\n`, "utf8");
        await handle.sync();
        if (process.platform === "win32") {
          await runPowerShell({ operation: "apply-acl", path: lockPath });
        }
        const identity = await handle.stat();
        if (!identity.ino && !identity.dev) {
          throw new SecureStorageUnavailableError("Secure lock identity is unavailable");
        }
        return { path: lockPath, nonce: metadata.nonce, handle, identity };
      } catch (error) {
        if (handle) {
          await handle.close().catch(() => undefined);
        }
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
          throw error instanceof SecureSecretStoreError
            ? error
            : new SecureStorageUnavailableError("Unable to acquire secure secret lock", { cause: error });
        }
        if (Date.now() >= deadline) {
          throw new SecureStorageUnavailableError("Secure secret is locked by another process");
        }
        await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_INTERVAL_MS));
      }
    }
  }

  private async releaseInterprocessLock(lock: InterprocessLock): Promise<void> {
    try {
      const current = await fs.open(lock.path, "r");
      try {
        const currentIdentity = await current.stat();
        const raw = await current.readFile("utf8");
        const metadata = JSON.parse(raw) as Partial<SecretLockMetadata>;
        const sameIdentity = currentIdentity.dev === lock.identity.dev && currentIdentity.ino === lock.identity.ino;
        if (!sameIdentity || metadata.version !== 1 || metadata.nonce !== lock.nonce) {
          throw new SecureStorageUnavailableError("Secure lock ownership could not be verified");
        }
      } finally {
        await current.close();
      }
      await fs.unlink(lock.path);
    } catch (error) {
      throw error instanceof SecureSecretStoreError
        ? error
        : new SecureStorageUnavailableError("Unable to release secure secret lock", { cause: error });
    } finally {
      await lock.handle.close().catch(() => undefined);
    }
  }
}

export const getDefaultSecureSecretStore = (): SecureSecretStore =>
  new FileSecureSecretStore(resolvePlatformPaths().secureSecretDir ?? join(resolvePlatformPaths().stateDir, "secrets"));

export const isSecureSecretStoreSupported = (): boolean =>
  process.platform === "win32" && process.arch === "x64" && Boolean(homedir());

export const resolveSecureMutexHelperPath = (): string | undefined => {
  if (process.platform !== "win32") return undefined;
  const configured = process.env.PERIPHERALS_SECURE_MUTEX_HELPER_PATH;
  if (configured) return configured;
  const candidate = join(dirname(dirname(process.execPath)), "ManusTerminalSetup.exe");
  return candidate;
};
