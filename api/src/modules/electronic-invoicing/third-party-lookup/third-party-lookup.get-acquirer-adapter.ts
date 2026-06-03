import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  ThirdPartyLookupAdapter,
  ThirdPartyLookupAdapterOptions,
} from "./third-party-lookup.adapter";
import type { ValidatedGetAcquirerConfig } from "./third-party-lookup.config";
import type {
  NormalizedThirdPartyLookupRequest,
  ThirdPartyLookupContext,
  ThirdPartyLookupPreview,
} from "./third-party-lookup.types";

export type GetAcquirerRequestSkeleton = {
  operation: "GetAcquirer";
  externalCallEnabled: false;
  wsdlUrl: string;
  endpointUrl: string;
  timeoutMs: number;
  identificationType: string;
  identificationNumber: string;
  wsSecurity: {
    certificateConfigured: boolean;
    certificatePasswordConfigured: boolean;
    rawCertificateIncluded: false;
    rawPasswordIncluded: false;
    signatureStatus: "PLACEHOLDER";
  };
};

@Injectable()
export class ThirdPartyLookupGetAcquirerAdapter
  implements ThirdPartyLookupAdapter
{
  buildRequestSkeleton(
    input: NormalizedThirdPartyLookupRequest,
    config: ValidatedGetAcquirerConfig
  ): GetAcquirerRequestSkeleton {
    return {
      operation: "GetAcquirer",
      externalCallEnabled: false,
      wsdlUrl: config.wsdlUrl,
      endpointUrl: config.endpointUrl,
      timeoutMs: config.timeoutMs,
      identificationType: input.documentTypeCode,
      identificationNumber: input.documentNumberNormalized,
      wsSecurity: {
        certificateConfigured: config.certificatePath.length > 0,
        certificatePasswordConfigured: config.certificatePassword.length > 0,
        rawCertificateIncluded: false,
        rawPasswordIncluded: false,
        signatureStatus: "PLACEHOLDER",
      },
    };
  }

  lookup(
    input: NormalizedThirdPartyLookupRequest,
    context: ThirdPartyLookupContext,
    options: ThirdPartyLookupAdapterOptions = {}
  ): ThirdPartyLookupPreview {
    if (input.partyType !== "CUSTOMER") {
      return {
        ...context,
        partyType: input.partyType,
        lookupStatus: "ERROR",
        statusCode: "UNSUPPORTED_PARTY_TYPE",
        message: "DIAN GetAcquirer real lookup is only supported for customers",
        documentTypeCode: input.documentTypeCode,
        documentNumberNormalized: input.documentNumberNormalized,
        data: null,
        responseSummary: {
          fieldCount: 0,
          fields: [],
          hasLegalName: false,
          hasFiscalEmail: false,
        },
        fieldDiffs: [],
      };
    }

    if (!options.getAcquirerConfig) {
      throw new BadRequestException(
        "DIAN GetAcquirer real mode requires validated configuration"
      );
    }

    this.buildRequestSkeleton(input, options.getAcquirerConfig);

    return {
      ...context,
      partyType: input.partyType,
      lookupStatus: "ERROR",
      statusCode: "REAL_LOOKUP_NOT_IMPLEMENTED",
      message:
        "DIAN GetAcquirer SOAP/WS-Security skeleton is configured; real external calls are disabled in FE-3.5",
      documentTypeCode: input.documentTypeCode,
      documentNumberNormalized: input.documentNumberNormalized,
      data: null,
      responseSummary: {
        fieldCount: 0,
        fields: [],
        hasLegalName: false,
        hasFiscalEmail: false,
      },
      fieldDiffs: [],
    };
  }
}
