import { Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../../common/db/database.service";

type UserContextRow = {
  tenant_id: string;
  tenant_name: string;
  branch_id: string;
  branch_name: string;
  terminal_id: string | null;
  terminal_name: string | null;
  terminal_code: string | null;
};

@Injectable()
export class AuthRepository {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  async getUserContextRows(userId: string): Promise<UserContextRow[]> {
    const result = await this.db.query(
      `SELECT
        t.id AS tenant_id,
        t.nombre AS tenant_name,
        b.id AS branch_id,
        b.nombre AS branch_name,
        term.id AS terminal_id,
        term.name AS terminal_name,
        term.code AS terminal_code
      FROM users u
      INNER JOIN personas p
        ON p.id = u.persona_id
      INNER JOIN persona_tenant_branches ptb
        ON ptb.persona_id = p.id
      INNER JOIN tenant_branches b
        ON b.id = ptb.tenant_branch_id
       AND b.tenant_id = ptb.tenant_id
      INNER JOIN tenants t
        ON t.id = b.tenant_id
      LEFT JOIN terminals term
        ON term.branch_id = b.id
       AND term.tenant_id = b.tenant_id
       AND term.is_active = TRUE
      WHERE u.id = $1
        AND b.estado = 'ACTIVE'
      ORDER BY t.nombre ASC, b.nombre ASC, term.name ASC`,
      [userId]
    ) as { rows: UserContextRow[] };

    return result.rows ?? [];
  }
}
