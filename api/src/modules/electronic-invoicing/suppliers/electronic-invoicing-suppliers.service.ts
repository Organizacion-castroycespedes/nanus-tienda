import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import crypto from "crypto";
import type { CreateElectronicInvoicingSupplierDto } from "./dto/create-electronic-invoicing-supplier.dto";
import type { ListElectronicInvoicingSuppliersDto } from "./dto/list-electronic-invoicing-suppliers.dto";
import type { UpdateElectronicInvoicingSupplierDto } from "./dto/update-electronic-invoicing-supplier.dto";
import type {
  CreateElectronicInvoicingSupplierInput,
  ListElectronicInvoicingSuppliersFilters,
  SupplierFiscalLastLookupStatus,
  SupplierFiscalStatus,
  UpdateElectronicInvoicingSupplierInput,
} from "./electronic-invoicing-supplier.types";
import { ElectronicInvoicingSuppliersRepository } from "./electronic-invoicing-suppliers.repository";

const VALID_FISCAL_STATUSES = new Set<SupplierFiscalStatus>([
  "PENDING",
  "VALIDATED",
  "FAILED",
  "NOT_REQUIRED",
]);

const VALID_LOOKUP_STATUSES = new Set<SupplierFiscalLastLookupStatus>([
  "PENDING",
  "FOUND",
  "NOT_FOUND",
  "ERROR",
  "SKIPPED",
]);

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hasOwn = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

export const normalizeSupplierFiscalDocument = (
  value?: string | null
): string | null => {
  const normalized = value?.trim().toUpperCase().replace(/[^0-9A-Z]/g, "") ?? "";
  return normalized.length > 0 ? normalized : null;
};

@Injectable()
export class ElectronicInvoicingSuppliersService {
  constructor(
    @Inject(ElectronicInvoicingSuppliersRepository)
    private readonly suppliersRepository: ElectronicInvoicingSuppliersRepository
  ) {}

  private parseBoolean(value: unknown, fieldName: string): boolean | undefined {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") {
        return true;
      }
      if (normalized === "false") {
        return false;
      }
    }
    throw new BadRequestException(`${fieldName} must be true or false`);
  }

  private normalizeText(value?: string | null): string | null {
    const normalized = value?.trim() ?? "";
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeFiscalEmail(value?: string | null): string | null {
    const email = this.normalizeText(value)?.toLowerCase() ?? null;
    if (email && !BASIC_EMAIL_REGEX.test(email)) {
      throw new BadRequestException("fiscalEmail is invalid");
    }
    return email;
  }

  private normalizeFiscalStatus(
    value?: SupplierFiscalStatus | null
  ): SupplierFiscalStatus | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (!VALID_FISCAL_STATUSES.has(value)) {
      throw new BadRequestException("fiscalStatus is invalid");
    }
    return value;
  }

  private normalizeLookupStatus(
    value?: SupplierFiscalLastLookupStatus | null
  ): SupplierFiscalLastLookupStatus | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    if (!VALID_LOOKUP_STATUSES.has(value)) {
      throw new BadRequestException("fiscalLastLookupStatus is invalid");
    }
    return value;
  }

  private buildFilters(
    query: ListElectronicInvoicingSuppliersDto
  ): ListElectronicInvoicingSuppliersFilters {
    return {
      search: this.normalizeText(query.search) ?? undefined,
      documentTypeCode: this.normalizeText(query.documentTypeCode) ?? undefined,
      documentNumber:
        normalizeSupplierFiscalDocument(query.documentNumber) ??
        this.normalizeText(query.documentNumber) ??
        undefined,
      fiscalStatus: this.normalizeFiscalStatus(query.fiscalStatus),
      isActive: this.parseBoolean(query.isActive, "isActive"),
    };
  }

  private async ensureNoDuplicateDocument(
    tenantId: string,
    documentNumberNormalized: string | null,
    excludeSupplierId?: string
  ) {
    if (!documentNumberNormalized) {
      return;
    }
    const duplicate = await this.suppliersRepository.findByNormalizedDocument(
      tenantId,
      documentNumberNormalized,
      excludeSupplierId
    );
    if (duplicate) {
      throw new ConflictException("documentNumber already exists for tenant");
    }
  }

  listSuppliers(
    tenantId: string,
    query: ListElectronicInvoicingSuppliersDto
  ) {
    return this.suppliersRepository.listByTenant(
      tenantId,
      this.buildFilters(query)
    );
  }

  async createSupplier(
    tenantId: string,
    dto: CreateElectronicInvoicingSupplierDto
  ) {
    const name = this.normalizeText(dto.name);
    if (!name) {
      throw new BadRequestException("name is required");
    }

    const documentNumber = this.normalizeText(dto.documentNumber);
    const documentNumberNormalized =
      normalizeSupplierFiscalDocument(documentNumber);
    const fiscalEmail = this.normalizeFiscalEmail(dto.fiscalEmail);
    const fiscalStatus = this.normalizeFiscalStatus(dto.fiscalStatus) ?? "PENDING";

    await this.ensureNoDuplicateDocument(tenantId, documentNumberNormalized);

    const input: CreateElectronicInvoicingSupplierInput = {
      id: crypto.randomUUID(),
      tenantId,
      name,
      documentNumber,
      documentTypeCode: this.normalizeText(dto.documentTypeCode),
      documentNumberNormalized,
      verificationDigit: this.normalizeText(dto.verificationDigit),
      legalName: this.normalizeText(dto.legalName),
      fiscalEmail,
      fiscalStatus,
      fiscalProvider: this.normalizeText(dto.fiscalProvider),
      isActive: dto.isActive ?? true,
    };

    return this.suppliersRepository.create(input);
  }

  async updateSupplier(
    id: string,
    tenantId: string,
    dto: UpdateElectronicInvoicingSupplierDto
  ) {
    const current = await this.suppliersRepository.findById(id, tenantId);
    if (!current) {
      throw new NotFoundException("supplier not found");
    }

    const update: UpdateElectronicInvoicingSupplierInput = {};

    if (hasOwn(dto, "name")) {
      const nextName = this.normalizeText(dto.name);
      if (!nextName) {
        throw new BadRequestException("name is required");
      }
      update.name = nextName;
    }

    if (hasOwn(dto, "documentNumber")) {
      update.documentNumber = this.normalizeText(dto.documentNumber);
      update.documentNumberNormalized = normalizeSupplierFiscalDocument(
        dto.documentNumber
      );
      await this.ensureNoDuplicateDocument(
        tenantId,
        update.documentNumberNormalized ?? null,
        id
      );
    }

    if (hasOwn(dto, "documentTypeCode")) {
      update.documentTypeCode = this.normalizeText(dto.documentTypeCode);
    }
    if (hasOwn(dto, "verificationDigit")) {
      update.verificationDigit = this.normalizeText(dto.verificationDigit);
    }
    if (hasOwn(dto, "legalName")) {
      update.legalName = this.normalizeText(dto.legalName);
    }
    if (hasOwn(dto, "fiscalEmail")) {
      update.fiscalEmail = this.normalizeFiscalEmail(dto.fiscalEmail);
    }
    if (hasOwn(dto, "fiscalStatus")) {
      update.fiscalStatus =
        this.normalizeFiscalStatus(dto.fiscalStatus) ?? "PENDING";
    }
    if (hasOwn(dto, "fiscalProvider")) {
      update.fiscalProvider = this.normalizeText(dto.fiscalProvider);
    }
    if (hasOwn(dto, "fiscalLastLookupStatus")) {
      update.fiscalLastLookupStatus = this.normalizeLookupStatus(
        dto.fiscalLastLookupStatus
      );
    }
    if (hasOwn(dto, "isActive")) {
      update.isActive = dto.isActive ?? true;
    }

    const updated = await this.suppliersRepository.update(id, tenantId, update);
    if (!updated) {
      throw new NotFoundException("supplier not found");
    }
    return updated;
  }
}
