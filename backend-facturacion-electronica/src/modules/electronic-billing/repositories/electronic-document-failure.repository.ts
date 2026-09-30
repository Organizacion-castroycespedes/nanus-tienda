import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../database/database.service";
import type {
  ElectronicFailureDetailClass,
  ElectronicFailureDetailInput,
  ElectronicFailureOrigin,
} from "../domain/electronic-billing-failure";

export type ElectronicDocumentFailureDetailRow = {
  id: string;
  attempt: number;
  origin: ElectronicFailureOrigin;
  code: string | null;
  message: string;
  path: string | null;
  severity: string | null;
  http_status: number | null;
  failure_class: ElectronicFailureDetailClass;
  resolution_code: string | null;
  resolution_title: string | null;
  resolution_solution: string | null;
  resolution_retryable: boolean | null;
  created_at: Date;
};

export type FiscalFailureResolutionRow = {
  code: string;
  origin: ElectronicFailureOrigin;
  title: string;
  solution_text: string;
  retryable: boolean;
};

@Injectable()
export class ElectronicDocumentFailureRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  private async query<T extends QueryResultRow>(text: string, params: unknown[], client?: PoolClient) {
    if (client) {
      return client.query<T>(text, params);
    }
    return this.db.query<T>(text, params);
  }

  async insertMany(
    tenantId: string,
    electronicDocumentId: string,
    attempt: number,
    details: ElectronicFailureDetailInput[],
    client?: PoolClient,
  ) {
    for (const detail of details) {
      await this.query(
        `
          INSERT INTO electronic_document_failure_details (
            tenant_id,
            electronic_document_id,
            attempt,
            origin,
            code,
            message,
            path,
            severity,
            http_status,
            failure_class,
            resolution_code,
            raw_detail
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            (
              SELECT r.code
              FROM fiscal_failure_resolutions r
              WHERE r.active = TRUE
                AND r.code = ANY($11::text[])
              ORDER BY array_position($11::text[], r.code)
              LIMIT 1
            ),
            $12::jsonb
          )
        `,
        [
          tenantId,
          electronicDocumentId,
          Math.max(1, attempt),
          detail.origin,
          detail.code,
          detail.message,
          detail.path,
          detail.severity,
          detail.httpStatus,
          detail.failureClass,
          detail.resolutionCandidates,
          JSON.stringify(detail.rawDetail ?? {}),
        ],
        client,
      );
    }
  }

  async findLatestAttempt(tenantId: string, electronicDocumentId: string) {
    const result = await this.query<ElectronicDocumentFailureDetailRow>(
      `
        SELECT
          d.id,
          d.attempt,
          d.origin,
          d.code,
          d.message,
          d.path,
          d.severity,
          d.http_status,
          d.failure_class,
          d.resolution_code,
          r.title AS resolution_title,
          r.solution_text AS resolution_solution,
          r.retryable AS resolution_retryable,
          d.created_at
        FROM electronic_document_failure_details d
        LEFT JOIN fiscal_failure_resolutions r ON r.code = d.resolution_code
        WHERE d.tenant_id = $1
          AND d.electronic_document_id = $2
          AND d.attempt = (
            SELECT MAX(latest.attempt)
            FROM electronic_document_failure_details latest
            WHERE latest.tenant_id = $1
              AND latest.electronic_document_id = $2
          )
        ORDER BY d.created_at ASC, d.id ASC
      `,
      [tenantId, electronicDocumentId],
    );
    return result.rows;
  }

  async findResolution(candidates: string[]) {
    if (candidates.length === 0) {
      return null;
    }
    const result = await this.query<FiscalFailureResolutionRow>(
      `
        SELECT code, origin, title, solution_text, retryable
        FROM fiscal_failure_resolutions
        WHERE active = TRUE
          AND code = ANY($1::text[])
        ORDER BY array_position($1::text[], code)
        LIMIT 1
      `,
      [candidates],
    );
    return result.rows[0] ?? null;
  }
}
