import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { BuildSaleCompletedForElectronicBillingEventInput, SaleCompletedForElectronicBillingEventEnvelope } from "../contracts/integration-outbox-events";
import { buildSaleCompletedForElectronicBillingEvent } from "../mappers/sale-completed-for-electronic-billing.builder";
import { IntegrationOutboxRepository } from "../repositories/integration-outbox.repository";

@Injectable()
export class IntegrationOutboxService {
  constructor(
    @Inject(IntegrationOutboxRepository)
    private readonly repository: IntegrationOutboxRepository,
  ) {}

  buildSaleCompletedEvent(
    input: BuildSaleCompletedForElectronicBillingEventInput,
  ): SaleCompletedForElectronicBillingEventEnvelope {
    return buildSaleCompletedForElectronicBillingEvent(input);
  }

  async enqueue(
    event: SaleCompletedForElectronicBillingEventEnvelope,
    client?: PoolClient,
  ) {
    return this.repository.enqueue(
      {
        id: randomUUID(),
        event,
      },
      client,
    );
  }

  async enqueueSaleCompletedEvent(
    input: BuildSaleCompletedForElectronicBillingEventInput,
    client?: PoolClient,
  ) {
    return this.enqueue(this.buildSaleCompletedEvent(input), client);
  }

  async findByEventId(eventId: string, client?: PoolClient) {
    return this.repository.findByEventId(eventId, client);
  }

  async findBySource(
    tenantId: string,
    sourceType: string,
    sourceId: string,
    eventType: string,
    client?: PoolClient,
  ) {
    return this.repository.findBySource(tenantId, sourceType, sourceId, eventType, client);
  }

  async supersedePendingEvent(
    eventId: string,
    replacementEventId: string,
    supersededAt: Date,
    client?: PoolClient,
  ) {
    return this.repository.supersedePendingEvent(
      eventId,
      replacementEventId,
      supersededAt,
      client,
    );
  }

  async claimDueEvents(limit: number, leaseMs: number, client?: PoolClient) {
    return this.repository.claimDueEvents(
      {
        now: new Date(),
        limit,
        leaseMs,
      },
      client,
    );
  }

  async claimDueEvent(eventId: string, leaseMs: number, client?: PoolClient) {
    return this.repository.claimDueEvent(
      eventId,
      { now: new Date(), limit: 1, leaseMs },
      client,
    );
  }

  async markPublished(eventId: string, publishedAt: Date, client?: PoolClient) {
    return this.repository.markPublished(eventId, publishedAt, client);
  }

  async markRetryableFailure(
    eventId: string,
    input: { nextAttemptAt: Date; lastError: string },
    client?: PoolClient,
  ) {
    return this.repository.markRetryableFailure(eventId, input, client);
  }

  async markTerminalFailure(
    eventId: string,
    input: { lastError: string; failedAt?: Date },
    client?: PoolClient,
  ) {
    return this.repository.markTerminalFailure(eventId, input, client);
  }

  async reactivateForRetry(eventId: string, client?: PoolClient) {
    return this.repository.reactivateForRetry(eventId, client);
  }
}
