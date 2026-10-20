import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { Socket } from "node:net";
import { after, mock } from "node:test";

/** Install after imports, before registering tests. No process or socket may
 * escape the injected fakes, even when an adapter catches the thrown error. */
export const forbidHardwareIO = (): void => {
  let attempts = 0;
  const deny = () => {
    attempts += 1;
    throw new Error("TEST_HARDWARE_IO_FORBIDDEN");
  };
  const commands = ["exec", "execSync", "execFile", "execFileSync", "spawn", "spawnSync", "fork"] as const;
  const guards = commands.map((name) => mock.method(childProcess, name, deny));
  const socketGuard = mock.method(Socket.prototype, "connect", deny);
  syncBuiltinESMExports();
  after(() => {
    try {
      assert.equal(attempts, 0, "A test reached a forbidden native process/socket boundary");
      for (const guard of guards) assert.equal(guard.mock.callCount(), 0);
      assert.equal(socketGuard.mock.callCount(), 0);
    } finally {
      for (const guard of guards) guard.mock.restore();
      socketGuard.mock.restore();
      syncBuiltinESMExports();
    }
  });
};
