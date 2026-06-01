import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import crypto from "crypto";
import { ElectronicInvoicingCustomersRepository } from "./electronic-invoicing-customers.repository";
import type { CreateElectronicInvoicingCustomerDto } from "./dto/create-electronic-invoicing-customer.dto";
import type { ListElectronicInvoicingCustomersDto } from "./dto/list-electronic-invoicing-customers.dto";
import type { UpdateElectronicInvoicingCustomerDto } from "./dto/update-electronic-invoicing-customer.dto";
import type {
  CreateElectronicInvoicingCustomerInput,
  FiscalStatus,
  ListElectronicInvoicingCustomersFilters,
  UpdateElectronicInvoicingCustomerInput,
} from "./electronic-invoicing-customer.types";

type PgErrorLike = {
  code?: string;
  constraint?: string;
};

const VALID_FISCAL_STATUSES = new Set<FiscalStatus>([
  "PENDING",
  "VALIDATED",
  "FAILED",
  "NOT_REQUIRED",
]);

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_FINAL_CONSUMER_NAME = "Consumidor Final";

const hasOwn = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

export const normalizeFiscalDocument = (value?: string | null): string | null => {
  const normalized = value?.trim().toUpperCase().replace(/[^0-9A-Z]/g, "") ?? "";
  return normalized.length > 0 ? normalized : null;
};

@Injectable()
export class ElectronicInvoicingCustomersService {
  constructor(
    @Inject(ElectronicInvoicingCustomersRepository)
    private readonly customersRepository: ElectronicInvoicingCustomersRepository
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

  private normalizeFiscalStatus(value?: FiscalStatus | null): FiscalStatus | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (!VALID_FISCAL_STATUSES.has(value)) {
      throw new BadRequestException("fiscalStatus is invalid");
    }
    return value;
  }

  private buildFilters(
    query: ListElectronicInvoicingCustomersDto
  ): ListElectronicInvoicingCustomersFilters {
    const fiscalStatus = this.normalizeFiscalStatus(query.fiscalStatus);
    return {
      search: this.normalizeText(query.search) ?? undefined,
      documentTypeCode: this.normalizeText(query.documentTypeCode) ?? undefined,
      documentNumber: this.normalizeText(query.documentNumber) ?? undefined,
      isFinalConsumer: this.parseBoolean(
        query.isFinalConsumer,
        "isFinalConsumer"
      ),
      fiscalStatus,
      isActive: this.parseBoolean(query.isActive, "isActive"),
    };
  }

  private async ensureNoDuplicateDocument(
    tenantId: string,
    documentNumberNormalized: string | null,
    excludeCustomerId?: string
  ) {
    if (!documentNumberNormalized) {
      return;
    }
    const duplicate = await this.customersRepository.findByNormalizedDocument(
      tenantId,
      documentNumberNormalized,
      excludeCustomerId
    );
    if (duplicate) {
      throw new ConflictException("documentNumber already exists for tenant");
    }
  }

  private async ensureNoOtherFinalConsumer(
    tenantId: string,
    excludeCustomerId?: string
  ) {
    const current = await this.customersRepository.findActiveFinalConsumer(
      tenantId,
      excludeCustomerId
    );
    if (current) {
      throw new ConflictException("final consumer already exists for tenant");
    }
  }

  private isFinalConsumerUniqueError(error: unknown) {
    const pgError = error as PgErrorLike;
    return (
      pgError?.code === "23505" &&
      (pgError.constraint === "ux_customers_tenant_active_final_consumer" ||
        pgError.constraint === "ux_customers_tenant_default")
    );
  }

  listCustomers(tenantId: string, query: ListElectronicInvoicingCustomersDto) {
    return this.customersRepository.listByTenant(
      tenantId,
      this.buildFilters(query)
    );
  }

  async createCustomer(
    tenantId: string,
    dto: CreateElectronicInvoicingCustomerDto
  ) {
    const isFinalConsumer = dto.isFinalConsumer ?? false;
    const name =
      this.normalizeText(dto.name) ??
      (isFinalConsumer ? DEFAULT_FINAL_CONSUMER_NAME : null);

    if (!name) {
      throw new BadRequestException("name is required");
    }

    const documentNumber = this.normalizeText(dto.documentNumber);
    const documentNumberNormalized = normalizeFiscalDocument(documentNumber);
    const fiscalEmail = this.normalizeFiscalEmail(dto.fiscalEmail);
    const fiscalStatus =
      this.normalizeFiscalStatus(dto.fiscalStatus) ??
      (isFinalConsumer ? "NOT_REQUIRED" : "PENDING");

    await this.ensureNoDuplicateDocument(tenantId, documentNumberNormalized);
    if (isFinalConsumer && (dto.isActive ?? true)) {
      await this.ensureNoOtherFinalConsumer(tenantId);
    }

    const input: CreateElectronicInvoicingCustomerInput = {
      id: crypto.randomUUID(),
      tenantId,
      name,
      documentNumber,
      documentTypeCode: this.normalizeText(dto.documentTypeCode),
      documentNumberNormalized,
      verificationDigit: this.normalizeText(dto.verificationDigit),
      legalName: this.normalizeText(dto.legalName),
      fiscalEmail,
      isFinalConsumer,
      fiscalStatus,
      isActive: dto.isActive ?? true,
    };

    try {
      return await this.customersRepository.create(input);
    } catch (error) {
      if (this.isFinalConsumerUniqueError(error)) {
        throw new ConflictException("final consumer already exists for tenant");
      }
      throw error;
    }
  }

  async updateCustomer(
    id: string,
    tenantId: string,
    dto: UpdateElectronicInvoicingCustomerDto
  ) {
    const current = await this.customersRepository.findById(id, tenantId);
    if (!current) {
      throw new NotFoundException("customer not found");
    }

    const update: UpdateElectronicInvoicingCustomerInput = {};

    if (hasOwn(dto, "name")) {
      const nextName = this.normalizeText(dto.name);
      if (!nextName && !(dto.isFinalConsumer ?? current.isFinalConsumer)) {
        throw new BadRequestException("name is required");
      }
      update.name = nextName ?? DEFAULT_FINAL_CONSUMER_NAME;
    }

    if (hasOwn(dto, "documentNumber")) {
      update.documentNumber = this.normalizeText(dto.documentNumber);
      update.documentNumberNormalized = normalizeFiscalDocument(dto.documentNumber);
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
    if (hasOwn(dto, "isActive")) {
      update.isActive = dto.isActive ?? true;
    }
    if (hasOwn(dto, "isFinalConsumer")) {
      update.isFinalConsumer = dto.isFinalConsumer ?? false;
      if (update.isFinalConsumer && (update.isActive ?? current.isActive)) {
        await this.ensureNoOtherFinalConsumer(tenantId, id);
      }
      if (update.isFinalConsumer && !hasOwn(update, "fiscalStatus")) {
        update.fiscalStatus = "NOT_REQUIRED";
      }
    }

    try {
      const updated = await this.customersRepository.update(id, tenantId, update);
      if (!updated) {
        throw new NotFoundException("customer not found");
      }
      return updated;
    } catch (error) {
      if (this.isFinalConsumerUniqueError(error)) {
        throw new ConflictException("final consumer already exists for tenant");
      }
      throw error;
    }
  }

  async getDefaultFinalConsumer(tenantId: string) {
    const customer = await this.customersRepository.findActiveFinalConsumer(tenantId);
    if (!customer) {
      throw new NotFoundException("final consumer not found");
    }
    return customer;
  }

  async ensureDefaultFinalConsumer(tenantId: string) {
    const current = await this.customersRepository.findActiveFinalConsumer(tenantId);
    if (current) {
      return current;
    }

    try {
      return await this.createCustomer(tenantId, {
        name: DEFAULT_FINAL_CONSUMER_NAME,
        isFinalConsumer: true,
        fiscalStatus: "NOT_REQUIRED",
        isActive: true,
      });
    } catch (error) {
      if (
        error instanceof ConflictException ||
        this.isFinalConsumerUniqueError(error)
      ) {
        const existing = await this.customersRepository.findActiveFinalConsumer(
          tenantId
        );
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }
}
