import type { ValidatedGetAcquirerConfig } from "./third-party-lookup.config";
import type {
  NormalizedThirdPartyLookupRequest,
  ThirdPartyLookupContext,
  ThirdPartyLookupPreview,
} from "./third-party-lookup.types";

export type ThirdPartyLookupAdapterOptions = {
  getAcquirerConfig?: ValidatedGetAcquirerConfig;
};

export interface ThirdPartyLookupAdapter {
  lookup(
    input: NormalizedThirdPartyLookupRequest,
    context: ThirdPartyLookupContext,
    options?: ThirdPartyLookupAdapterOptions
  ): ThirdPartyLookupPreview;
}
