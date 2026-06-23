import { randomInt } from "crypto";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../common/db/database.service";

@Injectable()
export class DeliveryNumberService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  private buildCandidate() {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
    const timePart = now.getTime().toString(36).toUpperCase();
    const randomPart = randomInt(0, 36 ** 4)
      .toString(36)
      .padStart(4, "0")
      .toUpperCase();

    return `DOM-${datePart}-${timePart}-${randomPart}`;
  }

  async generate(
    tenantId: string,
    branchId: string,
    client?: PoolClient
  ): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = this.buildCandidate();
      const query = `
        SELECT 1
        FROM public.deliveries
        WHERE tenant_id = $1
          AND branch_id = $2
          AND delivery_number = $3
        LIMIT 1
      `;
      const result = client
        ? await client.query(query, [tenantId, branchId, candidate])
        : await this.db.query(query, [tenantId, branchId, candidate]);

      if (result.rows.length === 0) {
        return candidate;
      }
    }

    throw new BadRequestException("No se pudo generar numero de domicilio");
  }
}
