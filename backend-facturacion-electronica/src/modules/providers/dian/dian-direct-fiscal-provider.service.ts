import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Injectable } from "@nestjs/common";
import type {
  FiscalLookupInput,
  FiscalLookupResult,
} from "../../fiscal-lookup/fiscal-lookup.types";
import type { FiscalProviderAdapter } from "../provider-adapter.interface";
import { validateDianDirectConfig } from "./dian-config.validator";
import { assertDianEndpointAllowed } from "./dian-http-client.guard";
import { buildGetAcquirerRequest } from "./dian-get-acquirer.request-builder";
import { parseGetAcquirerResponse } from "./dian-get-acquirer.parser";

const DEFAULT_SUCCESS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <soap:Body>
    <GetAcquirerResponse>
      <cac:AccountingCustomerParty>
        <cac:Party>
          <cac:PartyIdentification>
            <cbc:ID schemeName="31">3199991</cbc:ID>
          </cac:PartyIdentification>
          <cac:Contact>
            <cbc:Name>Nombre NIT 1</cbc:Name>
            <cbc:ElectronicMail>Mail_NIT_1@mail.com</cbc:ElectronicMail>
          </cac:Contact>
        </cac:Party>
      </cac:AccountingCustomerParty>
      <cac:TaxRepresentativeParty>
        <cac:PartyIdentification>
          <cbc:ID>3199991</cbc:ID>
        </cac:PartyIdentification>
      </cac:TaxRepresentativeParty>
    </GetAcquirerResponse>
  </soap:Body>
</soap:Envelope>`;

const sha256 = (value: string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

@Injectable()
export class DianDirectFiscalProviderService implements FiscalProviderAdapter {
  async lookupParty(input: FiscalLookupInput): Promise<FiscalLookupResult> {
    if (input.partyType !== "CUSTOMER") {
      return {
        provider: "DIAN_DIRECT",
        partyType: input.partyType,
        documentTypeCode: input.documentTypeCode,
        documentNumberNormalized: input.documentNumberNormalized,
        legalName: "",
        fiscalEmail: "",
        lookupStatus: "SKIPPED",
        statusCode: "UNSUPPORTED_PARTY_TYPE",
        message: "DIAN GetAcquirer applies to CUSTOMER/acquirer only",
        responseSummary: {
          documentTypeCode: input.documentTypeCode,
          documentNumberMasked: "***",
        },
      };
    }

    const config = validateDianDirectConfig();
    const requestXml = buildGetAcquirerRequest(input);
    const responseXml = await this.resolveResponseXml(
      requestXml,
      config.endpointUrl || config.wsdlUrl,
      config.timeoutMs,
      config.getAcquirerAction,
      config.allowExternalCalls
    );
    const result = parseGetAcquirerResponse(responseXml, input);

    return {
      ...result,
      requestHash: sha256(requestXml),
    };
  }

  private async resolveResponseXml(
    requestXml: string,
    endpointUrl: string,
    timeoutMs: number,
    action: string,
    allowExternalCalls: boolean
  ): Promise<string> {
    const fixtureXml = this.readFixtureXml();
    if (fixtureXml) {
      return fixtureXml;
    }
    return this.postSoap(requestXml, endpointUrl, timeoutMs, action, allowExternalCalls);
  }

  private readFixtureXml(): string | null {
    const fixturePath = process.env.DIAN_GET_ACQUIRER_FIXTURE_PATH?.trim();
    if (!fixturePath) {
      return null;
    }

    const resolvedPath = resolve(fixturePath);
    if (!existsSync(resolvedPath)) {
      throw new Error("DIAN_GET_ACQUIRER_FIXTURE_PATH was not found");
    }

    return readFileSync(resolvedPath, "utf8");
  }

  private async postSoap(
    requestXml: string,
    endpointUrl: string,
    timeoutMs: number,
    action: string,
    allowExternalCalls: boolean
  ): Promise<string> {
    assertDianEndpointAllowed(endpointUrl, allowExternalCalls);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": `application/soap+xml; charset=utf-8; action="${action}"`,
        },
        body: requestXml,
        signal: controller.signal,
      });

      return await response.text();
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "DIAN GetAcquirer request timed out"
          : "DIAN GetAcquirer request failed";
      throw new Error(message);
    } finally {
      clearTimeout(timeout);
    }
  }
}
