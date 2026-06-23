import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { DeliveryStateMachineService } from "./delivery-state-machine.service";

test("DeliveryStateMachineService allows documented transitions", () => {
  const service = new DeliveryStateMachineService();

  assert.doesNotThrow(() =>
    service.assertCanTransition("CREADO", "EN_PREPARACION", "PREPARE")
  );
  assert.doesNotThrow(() =>
    service.assertCanTransition("CREADO", "DESPACHADO", "DISPATCH")
  );
  assert.doesNotThrow(() =>
    service.assertCanTransition("EN_PREPARACION", "DESPACHADO", "DISPATCH")
  );
  assert.doesNotThrow(() =>
    service.assertCanTransition("DESPACHADO", "ENTREGADO", "MARK_DELIVERED")
  );
  assert.doesNotThrow(() =>
    service.assertCanTransition(
      "DESPACHADO",
      "NO_ENTREGADO",
      "MARK_NOT_DELIVERED"
    )
  );
  assert.doesNotThrow(() =>
    service.assertCanTransition("NO_ENTREGADO", "DESPACHADO", "DISPATCH", {
      retryAllowed: true,
    })
  );
  assert.doesNotThrow(() =>
    service.assertCanTransition("CREADO", "CANCELADO", "CANCEL")
  );
});

test("DeliveryStateMachineService accepts legacy values and rejects invalid transitions", () => {
  const service = new DeliveryStateMachineService();

  assert.doesNotThrow(() =>
    service.assertCanTransition("CREATED", "EN_PREPARACION", "PREPARE")
  );

  assert.throws(
    () => service.assertCanTransition("EN_PREPARACION", "ENTREGADO", "MARK_DELIVERED"),
    BadRequestException
  );
  assert.throws(
    () => service.assertCanTransition("NO_ENTREGADO", "DESPACHADO", "DISPATCH"),
    BadRequestException
  );
  assert.throws(
    () => service.assertCanTransition("ENTREGADO", "CANCELADO", "CANCEL"),
    BadRequestException
  );
});
