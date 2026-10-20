import { createHash } from "node:crypto";

export type RochiIdentityInput = {
  profileId: string;
  pnpDeviceInstanceId: string;
  vendorId: string;
  productId: string;
  port?: string;
};

export const logicalRochiScaleId = (input: RochiIdentityInput): string => {
  if (input.profileId !== "ROCHI_A01E") throw new Error("SCALE_PROFILE_UNSUPPORTED");
  if (input.vendorId.toUpperCase() !== "1A86" || input.productId.toUpperCase() !== "7523") {
    throw new Error("SCALE_PNP_IDENTITY_UNSUPPORTED");
  }
  if (!input.pnpDeviceInstanceId.trim()) throw new Error("SCALE_PNP_IDENTITY_REQUIRED");
  const hash = createHash("sha256").update(input.pnpDeviceInstanceId.toUpperCase()).digest("hex").slice(0, 16);
  return `serial-rochi-a01e-${hash}`;
};

export const isCanonicalRochiScaleId = (value: string): boolean =>
  /^serial-rochi-a01e-[a-f0-9]{16}$/.test(value);
