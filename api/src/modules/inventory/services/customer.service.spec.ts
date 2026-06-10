import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { CustomerEntity } from "../entities/customer.entity";
import { CustomerService } from "./customer.service";

const tenantId = "11111111-1111-1111-1111-111111111111";
const customerId = "22222222-2222-2222-2222-222222222222";

const buildCustomer = (
  overrides: Partial<ConstructorParameters<typeof CustomerEntity>[0]> = {}
) =>
  CustomerEntity.create({
    id: customerId,
    tenantId,
    name: "Consumidor Final",
    documentNumber: null,
    phone: null,
    email: null,
    address: null,
    departamentoId: null,
    municipioId: null,
    ciudad: null,
    departamento: null,
    isFinalConsumer: false,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  });

const buildService = (customer: CustomerEntity) => {
  const repository = {
    findById: async () => customer,
    update: async () => buildCustomer({ isActive: false }),
    softDelete: async () => buildCustomer({ isActive: false }),
  };

  return new CustomerService(repository as never);
};

describe("CustomerService final consumer guards", () => {
  it("rejects soft delete for final consumer", async () => {
    const service = buildService(buildCustomer({ isFinalConsumer: true }));

    await assert.rejects(
      () => service.softDeleteCustomer(customerId, tenantId),
      BadRequestException
    );
  });

  it("rejects deactivation update for final consumer", async () => {
    const service = buildService(buildCustomer({ isFinalConsumer: true }));

    await assert.rejects(
      () =>
        service.updateCustomer(customerId, tenantId, {
          isActive: false,
        }),
      /final consumer cannot be deleted/
    );
  });
});
