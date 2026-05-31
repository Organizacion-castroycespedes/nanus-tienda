import { Inject, Injectable } from "@nestjs/common";
import type { QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import type { DianDocumentType } from "./dian-document-type.types";

type DianDocumentTypeRow = QueryResultRow & {
  id: string;
  code: string;
  name: string;
  description: string | null;
  country_code: string;
  is_active: boolean;
  valid_from: string | Date | null;
  valid_to: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

@Injectable()
export class DianDocumentTypesRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService
  ) {}

  private mapRow(row: DianDocumentTypeRow): DianDocumentType {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      countryCode: row.country_code,
      isActive: row.is_active,
      validFrom: row.valid_from ? new Date(row.valid_from) : null,
      validTo: row.valid_to ? new Date(row.valid_to) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findActive(countryCode = "CO"): Promise<DianDocumentType[]> {
    const result = await this.db.query<DianDocumentTypeRow>(
      `
        SELECT
          id,
          code,
          name,
          description,
          country_code,
          is_active,
          valid_from,
          valid_to,
          created_at,
          updated_at
        FROM dian_document_types
        WHERE country_code = $1
          AND is_active = true
          AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
          AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
        ORDER BY code ASC
      `,
      [countryCode]
    );

    return (result.rows ?? []).map((row) => this.mapRow(row));
  }
}
