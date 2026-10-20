import assert from "node:assert/strict";
import test from "node:test";
import { isCanonicalRochiScaleId, logicalRochiScaleId } from "./logical-scale-identity.domain";

test("ROCHI logical identity is PnP-derived and independent of COM", () => {
  const base = { profileId: "ROCHI_A01E", pnpDeviceInstanceId: "USB\\VID_1A86&PID_7523\\ABC", vendorId: "1a86", productId: "7523" };
  const com5 = logicalRochiScaleId({ ...base, port: "COM5" });
  const com8 = logicalRochiScaleId({ ...base, port: "COM8" });
  assert.equal(com5, com8);
  assert.equal(isCanonicalRochiScaleId(com5), true);
  assert.throws(() => logicalRochiScaleId({ ...base, pnpDeviceInstanceId: "", port: "COM5" }), /SCALE_PNP_IDENTITY_REQUIRED/);
});
