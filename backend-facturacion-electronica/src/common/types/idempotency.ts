export type IdempotencyScope = {
  tenantId?: string;
  partyType: "CUSTOMER" | "SUPPLIER";
  documentTypeCode: string;
  documentNumberNormalized: string;
};

export const buildFiscalPartyIdempotencyKey = (scope: IdempotencyScope) =>
  [
    scope.tenantId ?? "tenant-pending",
    scope.partyType,
    scope.documentTypeCode,
    scope.documentNumberNormalized,
  ].join(":");
