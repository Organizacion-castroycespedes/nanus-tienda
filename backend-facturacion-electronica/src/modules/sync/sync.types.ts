import type {
  FiscalLookupPreviewRequest,
  LookupStatus,
  PartyType,
} from "../fiscal-lookup/fiscal-lookup.types";

export type SyncTarget = "CUSTOMER" | "SUPPLIER";

export type SyncAction = "CREATE" | "UPDATE" | "SKIP";

export type SyncResult = {
  target: SyncTarget;
  action: SyncAction;
  targetId?: string;
  status: "PENDING" | "COMPLETED" | "SKIPPED";
  message: string;
};

export type FiscalLookupSyncRequest = FiscalLookupPreviewRequest;

export type FiscalLookupSyncAction = "CREATE" | "UPDATE" | "SKIP";

export type FiscalLookupSyncResult = {
  provider: "MOCK_LOCAL" | "DIAN_DIRECT" | "TECH_PROVIDER";
  partyType: PartyType;
  documentTypeCode: string;
  documentNumberNormalized: string;
  lookupStatus: LookupStatus;
  syncAction: FiscalLookupSyncAction;
  targetId: string | null;
  targetType: PartyType;
  message: string;
};

export type ApiFiscalParty = {
  id: string;
  name?: string | null;
  documentNumber?: string | null;
  documentTypeCode?: string | null;
  documentNumberNormalized?: string | null;
  legalName?: string | null;
  fiscalEmail?: string | null;
  fiscalStatus?: string | null;
  fiscalProvider?: string | null;
  fiscalLastLookupStatus?: string | null;
};
