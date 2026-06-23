import { BadRequestException, Injectable } from "@nestjs/common";
import {
  DELIVERY_FINAL_STATUSES,
  type DeliveryAction,
  type DeliveryStatus,
  normalizeDeliveryStatus,
} from "../deliveries.constants";

const transitionMatrix: Record<DeliveryAction, Partial<Record<DeliveryStatus, DeliveryStatus>>> = {
  PREPARE: {
    CREADO: "EN_PREPARACION",
  },
  DISPATCH: {
    CREADO: "DESPACHADO",
    EN_PREPARACION: "DESPACHADO",
    NO_ENTREGADO: "DESPACHADO",
  },
  MARK_DELIVERED: {
    DESPACHADO: "ENTREGADO",
  },
  MARK_NOT_DELIVERED: {
    DESPACHADO: "NO_ENTREGADO",
  },
  CANCEL: {
    CREADO: "CANCELADO",
    EN_PREPARACION: "CANCELADO",
  },
};

type TransitionGuardOptions = {
  retryAllowed?: boolean;
};

@Injectable()
export class DeliveryStateMachineService {
  private readonly finalStatuses = new Set<string>(DELIVERY_FINAL_STATUSES);

  isFinalStatus(status: string) {
    const operationalStatus = normalizeDeliveryStatus(status);
    return operationalStatus ? this.finalStatuses.has(operationalStatus) : false;
  }

  assertKnownStatus(status: string): asserts status is DeliveryStatus {
    if (!normalizeDeliveryStatus(status)) {
      throw new BadRequestException(`Estado de domicilio invalido: ${status}`);
    }
  }

  assertCanTransition(
    currentStatus: string,
    nextStatus: DeliveryStatus,
    action: DeliveryAction,
    options: TransitionGuardOptions = {}
  ) {
    this.assertKnownStatus(currentStatus);
    const operationalCurrentStatus = normalizeDeliveryStatus(currentStatus);
    if (!operationalCurrentStatus) {
      throw new BadRequestException(`Estado de domicilio invalido: ${currentStatus}`);
    }

    if (this.isFinalStatus(operationalCurrentStatus)) {
      throw new BadRequestException(
        `El domicilio esta en estado final ${operationalCurrentStatus}`
      );
    }

    if (
      operationalCurrentStatus === "NO_ENTREGADO" &&
      action === "DISPATCH" &&
      options.retryAllowed !== true
    ) {
      throw new BadRequestException("Reintento de domicilio no permitido");
    }

    const expectedNextStatus = transitionMatrix[action][operationalCurrentStatus];
    if (expectedNextStatus !== nextStatus) {
      throw new BadRequestException(
        `Transicion invalida para ${action}: ${operationalCurrentStatus} -> ${nextStatus}`
      );
    }
  }
}
