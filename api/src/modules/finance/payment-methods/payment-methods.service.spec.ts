import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { PaymentMethodsService } from "./payment-methods.service";

test("USER can list payment methods for POS operation", async () => {
  const repository = {
    list: async () => [],
  };
  const service = new PaymentMethodsService(
    repository as never,
    {} as never,
    {} as never
  );

  await assert.doesNotReject(
    service.list(
      {} as never,
      {
        userId: "user-1",
        tenantId: "tenant-1",
        roles: ["USER"],
      }
    )
  );
});

test("USER cannot create payment methods", async () => {
  const service = new PaymentMethodsService(
    {} as never,
    {} as never,
    {} as never
  );

  await assert.rejects(
    service.create({} as never, {
      userId: "user-1",
      tenantId: "tenant-1",
      roles: ["USER"],
    }),
    (error: unknown) =>
      error instanceof ForbiddenException && error.message === "No autorizado"
  );
});
