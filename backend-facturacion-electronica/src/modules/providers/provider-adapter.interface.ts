import type {
  FiscalLookupInput,
  FiscalLookupResult,
} from "../fiscal-lookup/fiscal-lookup.types";

export const FISCAL_PROVIDER_ADAPTER = "FISCAL_PROVIDER_ADAPTER";

export interface FiscalProviderAdapter {
  lookupParty(input: FiscalLookupInput): Promise<FiscalLookupResult>;
}
