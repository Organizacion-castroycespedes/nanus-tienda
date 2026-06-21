import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { DeliveryStateMachineService } from "./delivery-state-machine.service";

test("DeliveryStateMachineService allows documented transitions", () => {
  const service = new DeliveryStateMachineService();

  assert.doesNotThrow(() =>
    service.assertCanTransition("CREATED", "ASSIGNED", "ASSIGN")
  );
  assert.doesNotThrow(() =>
    service.assertCanTransition("ASSIGNED", "DISPATCHED", "DISPATCH")
  );
  assert.doesNotThrow(() =>
    service.assertCanTransition("DISPATCHED", "DELIVERED", "MARK_DELIVERED")
  );
  assert.doesNotThrow(() =>
    service.assertCanTransition(
      "DISPATCHED",
      "NOT_DELIVERED",
      "MARK_NOT_DELIVERED"
    )
  );
  assert.doesNotThrow(() =>
    service.assertCanTransition("CREATED", "CANCELLED", "CANCEL")
  );
});

test("DeliveryStateMachineService rejects invalid skips and final states", () => {
  const service = new DeliveryStateMachineService();

  assert.throws(
    () => service.assertCanTransition("CREATED", "DISPATCHED", "DISPATCH"),
    BadRequestException
  );
  assert.throws(
    () => service.assertCanTransition("ASSIGNED", "DELIVERED", "MARK_DELIVERED"),
    BadRequestException
  );
  assert.throws(
    () => service.assertCanTransition("DELIVERED", "CANCELLED", "CANCEL"),
    BadRequestException
  );
});
