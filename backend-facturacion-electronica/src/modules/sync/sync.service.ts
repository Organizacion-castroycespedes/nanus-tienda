import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  FISCAL_PROVIDER_ADAPTER,
  type FiscalProviderAdapter,
} from "../providers/provider-adapter.interface";
import type {
  FiscalLookupInput,
  FiscalLookupResult,
  PartyType,
} from "../fiscal-lookup/fiscal-lookup.types";
import type {
  ApiFiscalParty,
  FiscalLookupSyncRequest,
  FiscalLookupSyncResult,
  SyncResult,
  SyncTarget,
} from "./sync.types";

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: Record<string, unknown>;
};

class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

@Injectable()
export class SyncService {
  constructor(
    @Inject(FISCAL_PROVIDER_ADAPTER)
    private readonly fiscalProvider: FiscalProviderAdapter
  ) {}

  previewSkip(target: SyncTarget): SyncResult {
    return {
      target,
      action: "SKIP",
      status: "SKIPPED",
      message: "Sync with api is not implemented in this phase",
    };
  }

  async syncParty(
    request: FiscalLookupSyncRequest
  ): Promise<FiscalLookupSyncResult> {
    const input = this.buildInput(request);
    const lookup = await this.fiscalProvider.lookupParty(input);

    if (lookup.lookupStatus !== "FOUND") {
      return this.buildResult(lookup, "SKIP", null, lookup.message);
    }

    const existing = await this.findExisting(lookup);
    if (existing) {
      if (this.isAlreadySynced(existing, lookup)) {
        return this.buildResult(
          lookup,
          "SKIP",
          existing.id,
          `${lookup.partyType.toLowerCase()} already synchronized`
        );
      }

      const updated = await this.updateParty(lookup, existing.id);
      return this.buildResult(
        lookup,
        "UPDATE",
        updated.id,
        `${lookup.partyType.toLowerCase()} updated from mock lookup`
      );
    }

    try {
      const created = await this.createParty(lookup);
      return this.buildResult(
        lookup,
        "CREATE",
        created.id,
        `${lookup.partyType.toLowerCase()} created from mock lookup`
      );
    } catch (error) {
      if (!this.isConflictError(error)) {
        throw error;
      }

      const duplicate = await this.findExisting(lookup);
      if (!duplicate) {
        throw error;
      }

      return this.buildResult(
        lookup,
        "SKIP",
        duplicate.id,
        `${lookup.partyType.toLowerCase()} already existed after conflict`
      );
    }
  }

  normalizeDocumentNumber(documentNumber: string): string {
    return documentNumber.replace(/[\s.\-]/g, "").trim();
  }

  private buildInput(request: FiscalLookupSyncRequest): FiscalLookupInput {
    const partyType = this.normalizePartyType(request.partyType);
    const documentTypeCode = request.documentTypeCode?.trim();
    const documentNumber = request.documentNumber?.trim();

    if (!documentTypeCode) {
      throw new BadRequestException("documentTypeCode is required");
    }
    if (!documentNumber) {
      throw new BadRequestException("documentNumber is required");
    }

    const documentNumberNormalized =
      this.normalizeDocumentNumber(documentNumber);
    if (!documentNumberNormalized) {
      throw new BadRequestException("documentNumber is required");
    }

    return {
      partyType,
      documentTypeCode,
      documentNumber,
      documentNumberNormalized,
    };
  }

  private normalizePartyType(partyType: string | undefined): PartyType {
    if (partyType === "CUSTOMER" || partyType === "SUPPLIER") {
      return partyType;
    }
    throw new BadRequestException("partyType must be CUSTOMER or SUPPLIER");
  }

  private buildResult(
    lookup: FiscalLookupResult,
    syncAction: FiscalLookupSyncResult["syncAction"],
    targetId: string | null,
    message: string
  ): FiscalLookupSyncResult {
    return {
      provider: lookup.provider,
      partyType: lookup.partyType,
      documentTypeCode: lookup.documentTypeCode,
      documentNumberNormalized: lookup.documentNumberNormalized,
      lookupStatus: lookup.lookupStatus,
      syncAction,
      targetId,
      targetType: lookup.partyType,
      message,
    };
  }

  private async findExisting(
    lookup: FiscalLookupResult
  ): Promise<ApiFiscalParty | null> {
    const path = `${this.getPartyPath(lookup.partyType)}?documentNumber=${encodeURIComponent(
      lookup.documentNumberNormalized
    )}&documentTypeCode=${encodeURIComponent(lookup.documentTypeCode)}`;
    const result = await this.apiRequest<ApiFiscalParty[]>(path);
    return result[0] ?? null;
  }

  private createParty(lookup: FiscalLookupResult): Promise<ApiFiscalParty> {
    return this.apiRequest<ApiFiscalParty>(this.getPartyPath(lookup.partyType), {
      method: "POST",
      body: this.buildPayload(lookup),
    });
  }

  private updateParty(
    lookup: FiscalLookupResult,
    id: string
  ): Promise<ApiFiscalParty> {
    return this.apiRequest<ApiFiscalParty>(
      `${this.getPartyPath(lookup.partyType)}/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: this.buildPayload(lookup),
      }
    );
  }

  private buildPayload(lookup: FiscalLookupResult): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      name: lookup.legalName,
      documentTypeCode: lookup.documentTypeCode,
      documentNumber: lookup.documentNumberNormalized,
      legalName: lookup.legalName,
      fiscalEmail: lookup.fiscalEmail,
      fiscalStatus: "VALIDATED",
    };

    if (lookup.partyType === "SUPPLIER") {
      payload.fiscalProvider = lookup.provider;
      payload.fiscalLastLookupStatus = lookup.lookupStatus;
    }

    return payload;
  }

  private isAlreadySynced(
    existing: ApiFiscalParty,
    lookup: FiscalLookupResult
  ): boolean {
    return (
      existing.documentTypeCode === lookup.documentTypeCode &&
      existing.documentNumberNormalized === lookup.documentNumberNormalized &&
      existing.legalName === lookup.legalName &&
      existing.fiscalEmail === lookup.fiscalEmail &&
      existing.fiscalStatus === "VALIDATED" &&
      (lookup.partyType === "CUSTOMER" ||
        (existing.fiscalProvider === lookup.provider &&
          existing.fiscalLastLookupStatus === lookup.lookupStatus))
    );
  }

  private getPartyPath(partyType: PartyType): string {
    return partyType === "CUSTOMER"
      ? "/api/electronic-invoicing/customers"
      : "/api/electronic-invoicing/suppliers";
  }

  private async apiRequest<T>(
    path: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const apiBaseUrl = this.getApiBaseUrl();
    const token = this.getApiInternalToken();
    let response: Response;
    try {
      response = await this.callFetch(`${apiBaseUrl}${path}`, {
        method: options.method ?? "GET",
        headers: {
          Authorization: this.buildAuthorizationHeader(token),
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      throw new ServiceUnavailableException(`api unavailable: ${message}`);
    }

    if (!response.ok) {
      const message = await this.safeReadResponseMessage(response);
      if (response.status === 409) {
        throw new ApiRequestError(
          409,
          `api request failed with status 409: ${message}`
        );
      }
      throw new ServiceUnavailableException(
        `api request failed with status ${response.status}: ${message}`
      );
    }

    return (await response.json()) as T;
  }

  private callFetch(
    input: string,
    init: RequestInit
  ): Promise<Response> {
    if (typeof fetch !== "function") {
      throw new ServiceUnavailableException("fetch is not available");
    }
    return fetch(input, init);
  }

  private getApiBaseUrl(): string {
    const apiBaseUrl = process.env.API_BASE_URL?.trim();
    if (!apiBaseUrl) {
      throw new ServiceUnavailableException("API_BASE_URL is required for sync");
    }
    return apiBaseUrl.replace(/\/+$/, "");
  }

  private getApiInternalToken(): string {
    const token = process.env.API_INTERNAL_TOKEN?.trim();
    if (!token) {
      throw new ServiceUnavailableException(
        "API_INTERNAL_TOKEN is required for sync"
      );
    }
    return token;
  }

  private buildAuthorizationHeader(token: string): string {
    return token.toLowerCase().startsWith("bearer ") ? token : `Bearer ${token}`;
  }

  private async safeReadResponseMessage(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { message?: unknown };
      return typeof body.message === "string"
        ? body.message
        : response.statusText || "api error";
    } catch {
      return response.statusText || "api error";
    }
  }

  private isConflictError(error: unknown): boolean {
    return error instanceof ApiRequestError && error.status === 409;
  }
}
