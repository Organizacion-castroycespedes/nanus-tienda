import test from "node:test";
import assert from "node:assert/strict";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ReportsModule } from "./reports.module";
import { OperationalSalesReportsController } from "./operational-sales-reports.controller";
import { OperationalSalesReportsService } from "./operational-sales-reports.service";

@Module({ imports: [ReportsModule] })
class RuntimeTestModule {}

test("NestJS creates the complete operational report provider chain", async () => {
  process.env.DB_PASSWORD ??= "test";
  process.env.NODE_ENV ??= "test";
  const context = await NestFactory.createApplicationContext(RuntimeTestModule, { logger: false });
  try {
    assert.ok(context.get(OperationalSalesReportsService));
    assert.ok(context.get(OperationalSalesReportsController));
  } finally {
    await context.close();
  }
});
