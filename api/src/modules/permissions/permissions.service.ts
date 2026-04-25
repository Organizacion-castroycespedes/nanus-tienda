import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../common/db/database.service";

@Injectable()
export class PermissionsService {
  constructor(private readonly db: DatabaseService) {}

  async getMenuByRole(roleId: string, tenantId: string) {
    return this.db.query<{
      module: string;
      route: string;
      label: string;
      visible: boolean;
      access_level: string;
    }>(
      `
      SELECT
        mi.module,
        mi.route,
        mi.label,
        mi.visible,
        rmp.access_level
      FROM role_menu_permissions rmp
      INNER JOIN menu_items mi ON mi.id = rmp.menu_item_id
      WHERE rmp.role_id = $1
        AND rmp.tenant_id = $2
        AND mi.deleted_at IS NULL
      ORDER BY mi.module
      `,
      [roleId, tenantId]
    );
  }
}
