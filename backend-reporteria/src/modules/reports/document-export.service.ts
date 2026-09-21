import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../database/database.service";

export const REPORT_EXPORT_BATCH_SIZE = 1000;
export const MAX_REPORT_EXPORT_ROWS = 100000;

export type ReportExportBatchReader<T> = (
  client: PoolClient,
  offset: number,
  limit: number,
) => Promise<T[]>;

@Injectable()
export class DocumentExportService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async collect<T>(
    countRows: (client: PoolClient) => Promise<number>,
    readBatch: ReportExportBatchReader<T>,
  ): Promise<T[]> {
    const client = await this.database.getClient();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const totalRows = await countRows(client);
      if (!Number.isSafeInteger(totalRows) || totalRows < 0) {
        throw new BadRequestException("The report count is invalid");
      }
      if (totalRows > MAX_REPORT_EXPORT_ROWS) {
        throw new BadRequestException(
          `Report exceeds ${MAX_REPORT_EXPORT_ROWS} rows; narrow filters`,
        );
      }

      const rows: T[] = [];
      for (let offset = 0; offset < totalRows; offset += REPORT_EXPORT_BATCH_SIZE) {
        const batch = await readBatch(client, offset, REPORT_EXPORT_BATCH_SIZE);
        rows.push(...batch);
        if (batch.length === 0 || batch.length > REPORT_EXPORT_BATCH_SIZE) {
          throw new BadRequestException("Report export batch is invalid");
        }
      }
      if (rows.length !== totalRows) {
        throw new BadRequestException(
          "Report changed while exporting; retry with narrower filters",
        );
      }

      await client.query("COMMIT");
      return rows;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
