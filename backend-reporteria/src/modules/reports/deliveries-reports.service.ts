import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ReportUser } from "../auth/report-auth.types";
import { PdfmakeEngine } from "../pdf/pdfmake.engine";
import { buildDeliveryTicketTemplate } from "../pdf/templates/tickets/delivery-ticket.template";
import { DeliveriesReportAdapter } from "./sql-adapters/deliveries-report.adapter";
import type {
  DeliveryTicketDataset,
  ReportActorContext,
} from "./types/deliveries-report.types";

const ROLE_PRIORITY = ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"];

@Injectable()
export class DeliveriesReportsService {
  constructor(
    @Inject(DeliveriesReportAdapter)
    private readonly deliveriesReportAdapter: DeliveriesReportAdapter,
    @Inject(PdfmakeEngine)
    private readonly pdfEngine: PdfmakeEngine
  ) {}

  private pickActorRole(roles: string[]): string {
    for (const role of ROLE_PRIORITY) {
      if (roles.some((item) => item.toUpperCase() === role)) {
        return role;
      }
    }

    return roles[0]?.toUpperCase() ?? "USER";
  }

  private resolveActor(user?: ReportUser): ReportActorContext {
    if (!user?.id || !user.tenantId) {
      throw new BadRequestException("report actor is required");
    }

    return {
      userId: user.id,
      role: this.pickActorRole(user.roles),
      tenantId: user.tenantId,
      branchId: user.branchId ?? null,
      email: user.email ?? null,
    };
  }

  private toNumber(value: unknown) {
    return Number(value ?? 0);
  }

  private normalizeDeliveryTicketDataset(
    payload: DeliveryTicketDataset | null
  ): DeliveryTicketDataset {
    if (!payload) {
      throw new NotFoundException("delivery not found");
    }

    return {
      ...payload,
      source: {
        ...payload.source,
        orderTotal:
          payload.source.orderTotal === null
            ? null
            : this.toNumber(payload.source.orderTotal),
        saleTotal:
          payload.source.saleTotal === null
            ? null
            : this.toNumber(payload.source.saleTotal),
      },
      totals: {
        deliveryFee: this.toNumber(payload.totals.deliveryFee),
        sourceSubtotal: this.toNumber(payload.totals.sourceSubtotal),
        total: this.toNumber(payload.totals.total),
      },
    };
  }

  async getDeliveryTicket(deliveryId: string, user?: ReportUser) {
    const actor = this.resolveActor(user);
    const payload = await this.deliveriesReportAdapter.getDeliveryTicket(
      actor,
      deliveryId
    );
    if (!payload && (await this.deliveriesReportAdapter.deliveryExists(deliveryId))) {
      throw new ForbiddenException("delivery ticket is not authorized");
    }

    return this.normalizeDeliveryTicketDataset(payload);
  }

  async getDeliveryTicketPdf(deliveryId: string, user?: ReportUser) {
    const dataset = await this.getDeliveryTicket(deliveryId, user);
    return this.pdfEngine.generatePdf(buildDeliveryTicketTemplate(dataset));
  }
}
