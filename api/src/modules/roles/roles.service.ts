import { BadRequestException, Injectable, NotFoundException, Inject } from "@nestjs/common";
import { DatabaseService } from "../../common/db/database.service";
import type { CreateRoleDto } from "./dto/create-role.dto";
import type { UpdateRoleDto } from "./dto/update-role.dto";

export type RoleRecord = {
  id: string;
  nombre: string;
  descripcion: string | null;
  created_at: string;
  tenant_ids?: string[];
};

type ActorContext = {
  roles: string[];
  tenantId?: string;
  userId?: string;
};

@Injectable()
export class RolesService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  async listRoles(actor: ActorContext): Promise<RoleRecord[]> {
    const userId = this.ensureUserId(actor);
    const result = await this.db.query<RoleRecord>(
      `
      SELECT
        roles.id,
        roles.nombre,
        roles.descripcion,
        roles.created_at,
        COALESCE(
          ARRAY_AGG(DISTINCT user_roles.tenant_id)
            FILTER (WHERE user_roles.user_id = $1),
          '{}'::uuid[]
        ) AS tenant_ids
      FROM roles
      LEFT JOIN user_roles
        ON user_roles.role_id = roles.id
        AND user_roles.user_id = $1
      GROUP BY roles.id
      ORDER BY roles.nombre ASC
      `,
      [userId]
    );
    return result.rows ?? [];
  }

  async createRole(payload: CreateRoleDto, actor: ActorContext) {
    const nombre = payload.nombre?.trim();
    if (!nombre) {
      throw new BadRequestException("Nombre requerido");
    }
    const userId = this.ensureUserId(actor);
    const tenantIds = this.normalizeTenantIds(payload.tenantIds);

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const created = await client.query<RoleRecord>(
        `
        INSERT INTO roles (nombre, descripcion)
        VALUES ($1, $2)
        RETURNING id, nombre, descripcion, created_at
        `,
        [nombre, payload.descripcion ?? null]
      );
      const role = created.rows[0];

      // if (tenantIds.length > 0) {
      //   await client.query(
      //     `
      //     INSERT INTO user_roles (user_id, role_id, tenant_id)
      //     SELECT $1, $2, tenant_id
      //     FROM unnest($3::uuid[]) AS tenant_id
      //     ON CONFLICT DO NOTHING
      //     `,
      //     [userId, role.id, tenantIds]
      //   );
      // }

      await client.query("COMMIT");
      return {
        ...role,
        tenant_ids: tenantIds,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateRole(roleId: string, payload: UpdateRoleDto, actor: ActorContext) {
    const userId = this.ensureUserId(actor);
    const nombre = payload.nombre?.trim();
    if (payload.nombre !== undefined && !nombre) {
      throw new BadRequestException("Nombre requerido");
    }

    const tenantIds =
      payload.tenantIds === undefined
        ? null
        : this.normalizeTenantIds(payload.tenantIds);

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const updated = await client.query<RoleRecord>(
        `
        UPDATE roles
        SET
          nombre = COALESCE($2, nombre),
          descripcion = COALESCE($3, descripcion)
        WHERE id = $1
        RETURNING id, nombre, descripcion, created_at
        `,
        [roleId, nombre ?? null, payload.descripcion ?? null]
      );

      const role = updated.rows[0];
      if (!role) {
        throw new NotFoundException("Rol no encontrado");
      }

      if (tenantIds !== null) {
        if (tenantIds.length === 0) {
          await client.query(
            `DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2`,
            [userId, roleId]
          );
        } else {
          await client.query(
            `
            DELETE FROM user_roles
            WHERE user_id = $1
              AND role_id = $2
              AND tenant_id <> ALL($3::uuid[])
            `,
            [userId, roleId, tenantIds]
          );
          // 
          // await client.query(
          //   `
          //   INSERT INTO user_roles (user_id, role_id, tenant_id)
          //   SELECT $1, $2, tenant_id
          //   FROM unnest($3::uuid[]) AS tenant_id
          //   ON CONFLICT DO NOTHING
          //   `,
          //   [userId, roleId, tenantIds]
          // );
        }
      }

      const refreshed = await client.query<RoleRecord>(
        `
        SELECT
          roles.id,
          roles.nombre,
          roles.descripcion,
          roles.created_at,
          COALESCE(
            ARRAY_AGG(DISTINCT user_roles.tenant_id)
              FILTER (WHERE user_roles.user_id = $2),
            '{}'::uuid[]
          ) AS tenant_ids
        FROM roles
        LEFT JOIN user_roles
          ON user_roles.role_id = roles.id
          AND user_roles.user_id = $2
        WHERE roles.id = $1
        GROUP BY roles.id
        `,
        [roleId, userId]
      );

      await client.query("COMMIT");
      return refreshed.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private ensureUserId(actor: ActorContext) {
    if (!actor.userId) {
      throw new BadRequestException("Usuario requerido");
    }
    return actor.userId;
  }

  private normalizeTenantIds(tenantIds: string[] | undefined) {
    if (!Array.isArray(tenantIds)) {
      return [];
    }
    return Array.from(
      new Set(tenantIds.map((tenantId) => tenantId.trim()).filter(Boolean))
    );
  }
}
