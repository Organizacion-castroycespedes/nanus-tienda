import type { ThirdPartyLookupField } from "../third-party-lookup.types";

export type ThirdPartyLookupDto = {
  documentTypeCode?: string | null;
  dianIdentificationType?: string | null;
  documentNumber?: string | null;
  identificationNumber?: string | null;
};

export type ApplyThirdPartyLookupDto = ThirdPartyLookupDto & {
  fieldsToApply?: ThirdPartyLookupField[] | null;
  selectedFields?: ThirdPartyLookupField[] | null;
  applyFields?: ThirdPartyLookupField[] | null;
};
