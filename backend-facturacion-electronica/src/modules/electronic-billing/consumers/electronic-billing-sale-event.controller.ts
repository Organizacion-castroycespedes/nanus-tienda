import {
  Body,
  Controller,
  Inject,
  Headers,
  ForbiddenException,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { SaleCompletedForElectronicBillingConsumerService } from "./electronic-billing-sale-event.consumer";
import type { ElectronicBillingConsumptionResult } from "./electronic-billing-consumer.types";
import type { SaleCompletedForElectronicBillingEventEnvelope } from "../contracts/electronic-billing-integration-events";

const normalizeBearer = (value: string | undefined) => {
  if (!value) {
    return null;
  }

  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : value.trim();
};

@Controller("internal/electronic-billing")
export class ElectronicBillingSaleEventController {
  constructor(
    @Inject(SaleCompletedForElectronicBillingConsumerService)
    private readonly consumer: SaleCompletedForElectronicBillingConsumerService,
  ) {}

  @Post("events/sale-completed")
  async receiveSaleCompletedEvent(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: SaleCompletedForElectronicBillingEventEnvelope,
  ): Promise<ElectronicBillingConsumptionResult> {
    console.debug("[ElectronicBillingSaleEventController] receive", {
      eventId: body?.eventId,
      eventType: body?.eventType,
      schemaVersion: body?.schemaVersion,
      tenantId: body?.tenantId,
      sourceType: body?.source?.type,
      sourceId: body?.source?.id,
      payloadKeys: Object.keys(body?.payload ?? {}),
    });
    this.assertInternalToken(authorization);
    return this.consumer.consume(body);
  }

  private assertInternalToken(authorization: string | undefined) {
    const configuredToken = process.env.API_INTERNAL_TOKEN?.trim();
    if (!configuredToken) {
      throw new UnauthorizedException("Internal auth token is not configured");
    }

    const token = normalizeBearer(authorization);
    if (!token) {
      throw new ForbiddenException("Missing internal authorization token");
    }

    if (token !== configuredToken) {
      throw new ForbiddenException("Invalid internal authorization token");
    }
  }
}
