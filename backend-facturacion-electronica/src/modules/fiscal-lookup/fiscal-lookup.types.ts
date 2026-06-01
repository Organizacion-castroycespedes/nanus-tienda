export type PartyType = "CUSTOMER" | "SUPPLIER";

export type LookupStatus = "FOUND" | "NOT_FOUND" | "ERROR" | "SKIPPED";

export type FiscalLookupPreviewRequest = {
  partyType?: string;
  documentTypeCode?: string;
  documentNumber?: string;
};

export type FiscalLookupInput = {
  partyType: PartyType;
  documentTypeCode: string;
  documentNumber: string;
  documentNumberNormalized: string;
};

export type FiscalLookupResult = {
  provider: "MOCK_LOCAL" | "DIAN_DIRECT" | "TECH_PROVIDER";
  partyType: PartyType;
  documentTypeCode: string;
  documentNumberNormalized: string;
  legalName: string;
  fiscalEmail: string;
  lookupStatus: LookupStatus;
  message: string;
  statusCode?: string;
  requestHash?: string;
  responseSummary?: Record<string, unknown>;
};
