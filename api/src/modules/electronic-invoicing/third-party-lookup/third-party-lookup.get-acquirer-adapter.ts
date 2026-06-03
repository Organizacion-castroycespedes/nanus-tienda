import { BadRequestException, Injectable } from "@nestjs/common";
import crypto from "crypto";
import type {
  ThirdPartyLookupAdapter,
  ThirdPartyLookupAdapterOptions,
} from "./third-party-lookup.adapter";
import type { ValidatedGetAcquirerConfig } from "./third-party-lookup.config";
import { buildGetAcquirerSoapRequest } from "./third-party-lookup.get-acquirer-request.builder";
import {
  signGetAcquirerSoapRequest,
  type GetAcquirerXmlSignatureMaterial,
} from "./third-party-lookup.get-acquirer-xml-signer";
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

export type GetAcquirerSignedSoapRequest = {
  operation: "GetAcquirer";
  externalCallEnabled: false;
  endpointUrl: string;
  timeoutMs: number;
  action: string;
  messageId: string;
  identificationType: string;
  identificationNumber: string;
  signedXml: string;
  signedXmlSha256: string;
  signedXmlSize: number;
  binarySecurityTokenId: string;
  signedReferenceUris: string[];
  rawCertificateIncluded: false;
  rawPasswordIncluded: false;
};

export type GetAcquirerSoapTransportResult = {
  externalCallMade: false;
  statusCode: "EXTERNAL_CALL_DISABLED";
  signedXmlSha256: string;
  signedXmlSize: number;
  hasBinarySecurityToken: boolean;
  hasSignature: boolean;
  signedReferenceUris: string[];
};

export interface GetAcquirerSoapTransport {
  submitSignedRequest(
    request: GetAcquirerSignedSoapRequest
  ): GetAcquirerSoapTransportResult;
}

export type GetAcquirerSigningMaterialProvider = (
  config: ValidatedGetAcquirerConfig
) => GetAcquirerXmlSignatureMaterial | null;

export type GetAcquirerRuntimeDependencies = {
  signingMaterialProvider: GetAcquirerSigningMaterialProvider;
  transport: GetAcquirerSoapTransport;
};

class DisabledGetAcquirerSoapTransport implements GetAcquirerSoapTransport {
  submitSignedRequest(
    request: GetAcquirerSignedSoapRequest
  ): GetAcquirerSoapTransportResult {
    return {
      externalCallMade: false,
      statusCode: "EXTERNAL_CALL_DISABLED",
      signedXmlSha256: request.signedXmlSha256,
      signedXmlSize: request.signedXmlSize,
      hasBinarySecurityToken: request.signedXml.includes("BinarySecurityToken"),
      hasSignature: request.signedXml.includes("<ds:Signature"),
      signedReferenceUris: request.signedReferenceUris,
    };
  }
}

@Injectable()
export class ThirdPartyLookupGetAcquirerAdapter
  implements ThirdPartyLookupAdapter
{
  private signingMaterialProvider: GetAcquirerSigningMaterialProvider | null =
    null;
  private transport: GetAcquirerSoapTransport =
    new DisabledGetAcquirerSoapTransport();

  configureGetAcquirerRuntime(
    dependencies: Partial<GetAcquirerRuntimeDependencies>
  ): void {
    if (dependencies.signingMaterialProvider) {
      this.signingMaterialProvider = dependencies.signingMaterialProvider;
    }
    if (dependencies.transport) {
      this.transport = dependencies.transport;
    }
  }

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

  buildSignedSoapRequest(
    input: NormalizedThirdPartyLookupRequest,
    config: ValidatedGetAcquirerConfig,
    material: GetAcquirerXmlSignatureMaterial,
    options: { createdAt: Date; messageId: string }
  ): GetAcquirerSignedSoapRequest {
    const soapRequest = buildGetAcquirerSoapRequest({
      createdAt: options.createdAt,
      endpointUrl: config.endpointUrl,
      identificationNumber: input.documentNumberNormalized,
      identificationType: input.documentTypeCode,
      messageId: options.messageId,
    });
    const signed = signGetAcquirerSoapRequest(soapRequest.xml, material);
    const signedXmlSha256 = crypto
      .createHash("sha256")
      .update(signed.signedXml)
      .digest("hex");

    return {
      operation: "GetAcquirer",
      externalCallEnabled: false,
      endpointUrl: config.endpointUrl,
      timeoutMs: config.timeoutMs,
      action: soapRequest.action,
      messageId: options.messageId,
      identificationType: input.documentTypeCode,
      identificationNumber: input.documentNumberNormalized,
      signedXml: signed.signedXml,
      signedXmlSha256,
      signedXmlSize: Buffer.byteLength(signed.signedXml, "utf8"),
      binarySecurityTokenId: signed.binarySecurityTokenId,
      signedReferenceUris: signed.signedReferenceUris,
      rawCertificateIncluded: false,
      rawPasswordIncluded: false,
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
    const signingMaterial = this.signingMaterialProvider?.(
      options.getAcquirerConfig
    );

    if (signingMaterial) {
      const signedRequest = this.buildSignedSoapRequest(
        input,
        options.getAcquirerConfig,
        signingMaterial,
        {
          createdAt: new Date(context.lookupAt),
          messageId: `urn:uuid:${context.correlationId}`,
        }
      );
      this.transport.submitSignedRequest(signedRequest);
    }

    return {
      ...context,
      partyType: input.partyType,
      lookupStatus: "ERROR",
      statusCode: "REAL_LOOKUP_NOT_IMPLEMENTED",
      message:
        "DIAN GetAcquirer signed SOAP request can be prepared locally; real external calls are disabled",
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
