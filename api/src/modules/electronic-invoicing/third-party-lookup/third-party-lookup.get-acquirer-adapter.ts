import { BadRequestException, Injectable } from "@nestjs/common";
import crypto from "crypto";
import type {
  ThirdPartyLookupAdapter,
  ThirdPartyLookupAdapterOptions,
} from "./third-party-lookup.adapter";
import type { ValidatedGetAcquirerConfig } from "./third-party-lookup.config";
import {
  assertGetAcquirerIdentificationType,
  buildGetAcquirerSoapRequest,
} from "./third-party-lookup.get-acquirer-request.builder";
import {
  signGetAcquirerSoapRequest,
  type GetAcquirerXmlSignatureMaterial,
} from "./third-party-lookup.get-acquirer-xml-signer";
import { GetAcquirerHttpTransport } from "./third-party-lookup.get-acquirer-http-transport";
import type {
  NormalizedThirdPartyLookupRequest,
  ThirdPartyLookupContext,
  ThirdPartyLookupPreview,
} from "./third-party-lookup.types";

export type GetAcquirerRequestSkeleton = {
  operation: "GetAcquirer";
  externalCallEnabled: boolean;
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
  externalCallEnabled: boolean;
  endpointUrl: string;
  timeoutMs: number;
  action: string;
  contentType: string;
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

export type GetAcquirerSoapTransportStatusCode =
  | "EXTERNAL_CALL_DISABLED"
  | "HTTP_OK"
  | "HTTP_ERROR"
  | "HTTP_TIMEOUT"
  | "HTTP_NETWORK_ERROR";

export type GetAcquirerSoapTransportResult = {
  externalCallMade: boolean;
  statusCode: GetAcquirerSoapTransportStatusCode;
  message: string;
  signedXmlSha256: string;
  signedXmlSize: number;
  hasBinarySecurityToken: boolean;
  hasSignature: boolean;
  signedReferenceUris: string[];
  httpStatus?: number;
  responseTextSha256?: string;
  responseTextSize?: number;
};

export interface GetAcquirerSoapTransport {
  submitSignedRequest(
    request: GetAcquirerSignedSoapRequest
  ): GetAcquirerSoapTransportResult | Promise<GetAcquirerSoapTransportResult>;
}

export type GetAcquirerSigningMaterialProvider = (
  config: ValidatedGetAcquirerConfig
) => GetAcquirerXmlSignatureMaterial | null;

export type GetAcquirerRuntimeDependencies = {
  signingMaterialProvider: GetAcquirerSigningMaterialProvider;
  transport: GetAcquirerSoapTransport;
};

@Injectable()
export class ThirdPartyLookupGetAcquirerAdapter
  implements ThirdPartyLookupAdapter
{
  private signingMaterialProvider: GetAcquirerSigningMaterialProvider | null =
    null;
  private transport: GetAcquirerSoapTransport =
    new GetAcquirerHttpTransport();

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
    const identificationType = this.assertIdentificationType(
      input.documentTypeCode
    );

    return {
      operation: "GetAcquirer",
      externalCallEnabled: config.httpEnabled,
      wsdlUrl: config.wsdlUrl,
      endpointUrl: config.endpointUrl,
      timeoutMs: config.timeoutMs,
      identificationType,
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

  private assertIdentificationType(value: string): string {
    try {
      return assertGetAcquirerIdentificationType(value);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : "DIAN GetAcquirer identificationType is invalid"
      );
    }
  }

  buildSignedSoapRequest(
    input: NormalizedThirdPartyLookupRequest,
    config: ValidatedGetAcquirerConfig,
    material: GetAcquirerXmlSignatureMaterial,
    options: { createdAt: Date; messageId: string }
  ): GetAcquirerSignedSoapRequest {
    const identificationType = this.assertIdentificationType(
      input.documentTypeCode
    );
    const soapRequest = buildGetAcquirerSoapRequest({
      createdAt: options.createdAt,
      endpointUrl: config.endpointUrl,
      identificationNumber: input.documentNumberNormalized,
      identificationType,
      messageId: options.messageId,
    });
    const signed = signGetAcquirerSoapRequest(soapRequest.xml, material);
    const signedXmlSha256 = crypto
      .createHash("sha256")
      .update(signed.signedXml)
      .digest("hex");

    return {
      operation: "GetAcquirer",
      externalCallEnabled: config.httpEnabled,
      endpointUrl: config.endpointUrl,
      timeoutMs: config.timeoutMs,
      action: soapRequest.action,
      contentType: soapRequest.contentType,
      messageId: options.messageId,
      identificationType,
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

  async lookup(
    input: NormalizedThirdPartyLookupRequest,
    context: ThirdPartyLookupContext,
    options: ThirdPartyLookupAdapterOptions = {}
  ): Promise<ThirdPartyLookupPreview> {
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
    let transportResult: GetAcquirerSoapTransportResult | null = null;

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
      transportResult = await this.transport.submitSignedRequest(signedRequest);
    }

    return {
      ...context,
      partyType: input.partyType,
      lookupStatus: "ERROR",
      statusCode: transportResult?.statusCode ?? "REAL_LOOKUP_NOT_IMPLEMENTED",
      message:
        transportResult?.message ??
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
