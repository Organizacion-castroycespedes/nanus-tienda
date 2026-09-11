import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { buildElectronicBillingInvoiceCommandFromSaleEvent } from "../../backend-facturacion-electronica/src/modules/electronic-billing/mappers/sale-completed-for-electronic-billing.mapper";
import { FactuCoreMapper } from "../../backend-facturacion-electronica/src/modules/electronic-billing/providers/factucore/factucore.mapper";

const env: Record<string, string> = {};
for (const line of fs.readFileSync(path.resolve("api/.env"), "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
  const index = trimmed.indexOf("=");
  let value = trimmed.slice(index + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  env[trimmed.slice(0, index).trim()] = value;
}
const tenant = "00000000-0000-0000-0000-000000000001";
const saleId = "30a0a076-d3df-483f-8966-d6e3c9f3717e";
const state = (value: unknown) => typeof value === "string" && value.trim() ? "PRESENT_NONEMPTY" : value === null ? "NULL" : "MISSING";
const location = (customer: any) => ({ cityName: state(customer?.metadata?.cityName), departmentCode: state(customer?.metadata?.departmentCode), departmentName: state(customer?.metadata?.departmentName), countryName: state(customer?.metadata?.countryName) });
const client = new Client({ host: env.DB_HOST, port: Number(env.DB_PORT ?? 5432), database: env.DB_DATABASE, user: env.DB_USERNAME, password: env.DB_PASSWORD, ssl: env.DB_SSL === "true" ? { rejectUnauthorized: false } : false });
const main = async () => {
  await client.connect();
  try {
    const row = (await client.query("select payload from integration_outbox_events where tenant_id=$1 and source_id=$2 and event_type='SALE_COMPLETED_FOR_ELECTRONIC_BILLING'", [tenant,saleId])).rows[0];
    if (!row) throw new Error("event not found");
    const event = { eventId: `SALE_COMPLETED_FOR_ELECTRONIC_BILLING:${tenant}:${saleId}`, eventType: "SALE_COMPLETED_FOR_ELECTRONIC_BILLING", schemaVersion: 1 as const, tenantId: tenant, correlationId: saleId, occurredAt: new Date().toISOString(), source: { type: "SALE" as const, id: saleId }, payload: row.payload };
    const command = buildElectronicBillingInvoiceCommandFromSaleEvent(event as any, { providerId:"qa", providerConfigId:"qa", tenantId:tenant, environment:"TEST", baseUrl:"http://127.0.0.1:8000", settings:{} } as any, "dry-run");
    const request = new FactuCoreMapper().buildInvoiceRequest(command);
    console.log(JSON.stringify({ commandLocation:location(command.customer), requestLocation:{ cityName:state((request as any).customer?.cityName), departmentCode:state((request as any).customer?.departmentCode), departmentName:state((request as any).customer?.departmentName), countryName:state((request as any).customer?.countryName) }, unitCodes:Array.from(new Set((request as any).lines.map((line:any)=>line.unitCode))), hasLines:Array.isArray((request as any).lines)&&((request as any).lines.length>0), hasPayment:Boolean((request as any).paymentMeansCode), hasTotals:Boolean(command.totals), hasDates:Boolean(command.issueDate) }));
  } finally { await client.end(); }
};
main().catch(e=>{console.error(e instanceof Error?e.message:"dry run failed");process.exitCode=1});
