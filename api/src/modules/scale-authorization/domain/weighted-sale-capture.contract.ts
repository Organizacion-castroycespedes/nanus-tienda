export type WeightedSaleCaptureReference = { captureId: string; nonce: string };

const allowedFields = new Set(["captureId", "nonce"]);

export const parseWeightedSaleCaptureReference = (value: unknown): WeightedSaleCaptureReference => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("CAPTURE_REFERENCE_INVALID");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowedFields.has(key))) throw new Error("CLIENT_WEIGHT_AUTHORITY_FORBIDDEN");
  if (typeof record.captureId !== "string" || !record.captureId.trim() || typeof record.nonce !== "string" || !record.nonce.trim()) {
    throw new Error("CAPTURE_REFERENCE_INVALID");
  }
  return { captureId: record.captureId, nonce: record.nonce };
};

export const saleModeRequiresWeightCapture = (mode: "UNIT" | "WEIGHT" | "BOTH", quantityMode: "UNIT" | "WEIGHT"): boolean =>
  mode === "WEIGHT" || (mode === "BOTH" && quantityMode === "WEIGHT");
