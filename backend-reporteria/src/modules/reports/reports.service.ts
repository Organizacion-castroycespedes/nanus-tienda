import { Inject, Injectable } from "@nestjs/common";
import type { ReportUser } from "../auth/report-auth.types";
import { FunctionRunnerService } from "../database/function-runner.service";
import { PdfmakeEngine } from "../pdf/pdfmake.engine";
import {
  buildBaseReportLayout,
  type DemoReportDataset,
} from "../pdf/templates/base/report-layout";

type DemoFunctionResult = {
  reportTitle?: string;
  tenantName?: string;
  branchName?: string;
  generatedAt?: string;
  items?: Array<{
    code: string;
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  total?: number;
};

@Injectable()
export class ReportsService {
  constructor(
    @Inject(FunctionRunnerService)
    private readonly functionRunnerService: FunctionRunnerService,
    @Inject(PdfmakeEngine)
    private readonly pdfEngine: PdfmakeEngine
  ) {}

  getHealth() {
    return {
      status: "ok",
      service: "backend-reporteria",
      timestamp: new Date().toISOString(),
    };
  }

  private buildFallbackDemoDataset(user?: ReportUser): DemoReportDataset {
    const items = [
      {
        code: "ITEM-001",
        description: "Producto demo A",
        quantity: 2,
        unitPrice: 12500,
        subtotal: 25000,
      },
      {
        code: "ITEM-002",
        description: "Producto demo B",
        quantity: 1,
        unitPrice: 18000,
        subtotal: 18000,
      },
    ];

    return {
      reportTitle: "Reporte Demo",
      tenantName: user?.tenantId ?? "Tenant Demo",
      branchName: user?.branchId ?? "Sucursal Demo",
      generatedAt: new Date().toISOString(),
      items,
      total: items.reduce((sum, item) => sum + item.subtotal, 0),
    };
  }

  private normalizeDemoDataset(
    payload: DemoFunctionResult | null | undefined,
    user?: ReportUser
  ): DemoReportDataset {
    const fallback = this.buildFallbackDemoDataset(user);

    if (!payload) {
      return fallback;
    }

    const items = Array.isArray(payload.items) && payload.items.length > 0
      ? payload.items.map((item) => ({
          code: item.code,
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          subtotal: Number(item.subtotal),
        }))
      : fallback.items;

    return {
      reportTitle: payload.reportTitle ?? fallback.reportTitle,
      tenantName: payload.tenantName ?? fallback.tenantName,
      branchName: payload.branchName ?? fallback.branchName,
      generatedAt: payload.generatedAt ?? fallback.generatedAt,
      items,
      total:
        payload.total !== undefined
          ? Number(payload.total)
          : items.reduce((sum, item) => sum + item.subtotal, 0),
    };
  }

  async getDemo(user?: ReportUser) {
    const result = await this.functionRunnerService.executeFunction<DemoFunctionResult | null>(
      "report_demo"
    );

    return this.normalizeDemoDataset(result, user);
  }

  async getDemoPdf(user?: ReportUser) {
    const dataset = await this.getDemo(user);
    const definition = buildBaseReportLayout(dataset);
    return this.pdfEngine.generatePdf(definition);
  }
}
