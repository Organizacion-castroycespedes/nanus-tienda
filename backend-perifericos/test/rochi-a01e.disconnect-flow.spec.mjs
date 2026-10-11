import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeAndRecover,
  RecoveryIdentityError,
} from "../scripts/qa-rochi-disconnect.flow.mjs";

const device = {
  path: "COM3",
  pnpId: "USB\\VID_1A86&PID_7523\\6&562675F&0&2",
};

test("physical reconnect confirmation does not invoke recovery", async () => {
  let reconnects = 0;
  await assert.rejects(
    authorizeAndRecover({
      device,
      expectedPnpId: device.pnpId,
      initialPath: "COM3",
      confirmRecovery: async () => {
        throw new Error("RECOVERY confirmation missing");
      },
      reconnect: async () => {
        reconnects += 1;
      },
      reopen: async () => {
        reconnects += 1;
      },
    }),
    /RECOVERY confirmation missing/
  );
  assert.equal(reconnects, 0);
});

test("valid RECOVERY confirmation permits exactly one same-path reconnect", async () => {
  let reconnects = 0;
  let detected;
  const result = await authorizeAndRecover({
    device,
    expectedPnpId: device.pnpId,
    initialPath: "COM3",
    onDetected: (value) => {
      detected = value;
    },
    confirmRecovery: async () => {},
    reconnect: async () => {
      reconnects += 1;
    },
    reopen: async () => {
      reconnects += 1;
    },
  });

  assert.equal(reconnects, 1);
  assert.deepEqual(detected, {
    path: "COM3",
    pnpId: "USB\\VID_1A86&PID_7523\\<instance>",
  });
  assert.deepEqual(result, detected);
});

test("same identity on a reassigned COM uses one explicit reopen", async () => {
  let reconnects = 0;
  let reopenedPath;
  await authorizeAndRecover({
    device: { ...device, path: "COM7" },
    expectedPnpId: device.pnpId,
    initialPath: "COM3",
    confirmRecovery: async () => {},
    reconnect: async () => {
      reconnects += 1;
    },
    reopen: async (path) => {
      reopenedPath = path;
    },
  });

  assert.equal(reconnects, 0);
  assert.equal(reopenedPath, "COM7");
});

test("wrong PnP identity blocks RECOVERY before confirmation", async () => {
  let confirmed = false;
  let reconnects = 0;
  await assert.rejects(
    authorizeAndRecover({
      device: { ...device, pnpId: "USB\\VID_1234&PID_5678\\other" },
      expectedPnpId: device.pnpId,
      initialPath: "COM3",
      confirmRecovery: async () => {
        confirmed = true;
      },
      reconnect: async () => {
        reconnects += 1;
      },
      reopen: async () => {
        reconnects += 1;
      },
    }),
    RecoveryIdentityError
  );
  assert.equal(confirmed, false);
  assert.equal(reconnects, 0);
});
