import { BadRequestException, Injectable } from "@nestjs/common";
import {
  DELIVERY_FINAL_STATUSES,
  DELIVERY_STATUSES,
  type DeliveryAction,
  type DeliveryStatus,
} from "../deliveries.constants";

const transitionMatrix: Record<DeliveryAction, Partial<Record<DeliveryStatus, DeliveryStatus>>> = {
  ASSIGN: {
    CREATED: "ASSIGNED",
  },
  DISPATCH: {
    ASSIGNED: "DISPATCHED",
  },
  MARK_DELIVERED: {
    DISPATCHED: "DELIVERED",
  },
  MARK_NOT_DELIVERED: {
    DISPATCHED: "NOT_DELIVERED",
  },
  CANCEL: {
    CREATED: "CANCELLED",
    ASSIGNED: "CANCELLED",
  },
};

@Injectable()
export class DeliveryStateMachineService {
  private readonly validStatuses = new Set<string>(DELIVERY_STATUSES);
  private readonly finalStatuses = new Set<string>(DELIVERY_FINAL_STATUSES);

  isFinalStatus(status: string) {
    return this.finalStatuses.has(status);
  }

  assertKnownStatus(status: string): asserts status is DeliveryStatus {
    if (!this.validStatuses.has(status)) {
      throw new BadRequestException(`Estado de domicilio invalido: ${status}`);
    }
  }

  assertCanTransition(
    currentStatus: string,
    nextStatus: DeliveryStatus,
    action: DeliveryAction
  ) {
    this.assertKnownStatus(currentStatus);

    if (this.isFinalStatus(currentStatus)) {
      throw new BadRequestException(
        `El domicilio esta en estado final ${currentStatus}`
      );
    }

    const expectedNextStatus = transitionMatrix[action][currentStatus];
    if (expectedNextStatus !== nextStatus) {
      throw new BadRequestException(
        `Transicion invalida para ${action}: ${currentStatus} -> ${nextStatus}`
      );
    }
  }
}
