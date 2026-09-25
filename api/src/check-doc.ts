import { DatabaseService } from "./common/db/database.service";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../backend-facturacion-electronica/.env") });

async function main() {
  const db = new DatabaseService();
  const saleId = "c7696609-81e1-4442-97c1-35468b4f3742";

  const docs = await db.query(
    "SELECT id, status, provider_status, provider_status_detail, cufe, last_error_code, last_error_message, processing_stage, created_at, updated_at FROM electronic_documents WHERE source_id = $1 ORDER BY created_at DESC",
    [saleId]
  );
  console.log("ELECTRONIC_DOCUMENTS:");
  console.log(JSON.stringify(docs.rows, null, 2));

  const outbox = await db.query(
    "SELECT event_id, event_type, status, attempt_count, last_error, created_at FROM integration_outbox_events WHERE source_id = $1 ORDER BY created_at DESC",
    [saleId]
  );
  console.log("\nOUTBOX EVENTS:");
  console.log(JSON.stringify(outbox.rows, null, 2));

  process.exit(0);
}

main().catch((err) => {
  console.error("Error executing query:", err);
  process.exit(1);
});
