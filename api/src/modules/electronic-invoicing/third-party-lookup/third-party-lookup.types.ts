export type ThirdPartyLookupPartyType = "CUSTOMER" | "SUPPLIER";

export type ThirdPartyLookupMode = "mock" | "disabled";

export type ThirdPartyLookupProvider = "MOCK_LOCAL" | "NONE";

export type ThirdPartyLookupStatus =
  | "FOUND"
  | "NOT_FOUND"
  | "ERROR"
  | "SKIPPED";

export const THIRD_PARTY_LOOKUP_FIELDS = [
  "name",
  "documentTypeCode",
  "documentNumber",
  "verificationDigit",
  "legalName",
  "tradeName",
  "fiscalEmail",
  "phone",
  "address",
  "countryCode",
  "departmentCode",
  "municipalityCode",
  "personType",
  "taxRegime",
  "taxResponsibilities",
] as const;

export type ThirdPartyLookupField = (typeof THIRD_PARTY_LOOKUP_FIELDS)[number];

export type ThirdPartyLookupPersonType = "NATURAL" | "JURIDICA" | "UNKNOWN";

export type ThirdPartyLookupRequest = {
  tenantId: string;
  partyType: ThirdPartyLookupPartyType;
  documentTypeCode?: string | null;
  dianIdentificationType?: string | null;
  documentNumber?: string | null;
  identificationNumber?: string | null;
};

export type NormalizedThirdPartyLookupRequest = ThirdPartyLookupRequest & {
  documentTypeCode: string;
  documentNumberNormalized: string;
};

export type ThirdPartyLookupContext = {
  lookupId: string;
  correlationId: string;
  provider: ThirdPartyLookupProvider;
  mode: ThirdPartyLookupMode;
  lookupAt: string;
  requestHash: string;
};

export type ThirdPartyLookupData = {
  name: string;
  documentNumber: string;
  documentTypeCode: string;
  documentNumberNormalized: string;
  dianIdentificationType: string;
  identificationNumber: string;
  verificationDigit: string | null;
  legalName: string;
  tradeName: string;
  fiscalEmail: string | null;
  invoiceEmail: string | null;
  phone: string | null;
  address: string | null;
  countryCode: string | null;
  departmentCode: string | null;
  municipalityCode: string | null;
  personType: ThirdPartyLookupPersonType;
  taxRegime: string | null;
  taxResponsibilities: string[];
};

export type ThirdPartyLookupResponseSummary = {
  fieldCount: number;
  fields: ThirdPartyLookupField[];
  hasLegalName: boolean;
  hasFiscalEmail: boolean;
};

export type ThirdPartyLookupFieldDiff = {
  field: ThirdPartyLookupField;
  currentValue: unknown;
  previewValue: unknown;
  hasChange: boolean;
  willApply: boolean;
};

export type ThirdPartyLookupPreview = ThirdPartyLookupContext & {
  partyType: ThirdPartyLookupPartyType;
  lookupStatus: ThirdPartyLookupStatus;
  statusCode: string;
  message: string;
  documentTypeCode: string;
  documentNumberNormalized: string;
  data: ThirdPartyLookupData | null;
  responseSummary: ThirdPartyLookupResponseSummary;
  fieldDiffs: ThirdPartyLookupFieldDiff[];
};

export type ThirdPartyLookupTargetSnapshot = Partial<
  Record<ThirdPartyLookupField, unknown>
> & {
  dianIdentificationType?: string | null;
  identificationNumber?: string | null;
  documentNumberNormalized?: string | null;
  invoiceEmail?: string | null;
};
