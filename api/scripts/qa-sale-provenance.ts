import { Client } from "pg";
import { config as loadEnv } from "dotenv";

loadEnv();

const saleIds = [
  "a8fe281a-1763-4148-875b-19bd99a29c2d",
  "30a0a076-d3df-483f-8966-d6e3c9f3717e",
];

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USERNAME ?? process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

const main = async () => {
  await client.connect();
  try {
    const sales = await client.query("SELECT id, tenant_id, status, type, payment_status, total, total_paid, customer_id, created_at FROM sales WHERE id = ANY($1::uuid[])", [saleIds]);
    const payments = await client.query("SELECT reference_id, COUNT(*)::int AS count, SUM(amount)::numeric AS total FROM payments WHERE reference_type = 'SALE' AND reference_id = ANY($1::uuid[]) GROUP BY reference_id", [saleIds]);
    const events = await client.query("SELECT source_id, COUNT(*)::int AS count, MIN(event_id) AS event_id, MIN(status) AS status FROM integration_outbox_events WHERE source_id = ANY($1::text[]) GROUP BY source_id", [saleIds]);
    console.log(JSON.stringify({
      database: (await client.query("SELECT current_database() AS database, current_schema() AS schema")).rows[0],
      sales: sales.rows,
      payments: payments.rows,
      events: events.rows,
    }));
  } finally {
    await client.end();
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "read failed");
  process.exitCode = 1;
});
