import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { DatabaseService } from "../../common/db/database.service";
import { CreateDeliveryDriverDto } from "./dto/create-delivery-driver.dto";
import { QueryDeliveryDriversDto } from "./dto/query-delivery-drivers.dto";
import { UpdateDeliveryDriverDto } from "./dto/update-delivery-driver.dto";

type DeliveryDriverActor = {
  tenantId?: string;
  userId?: string;
  roles: string[];
};

type DeliveryDriverRecord = {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  document_number: string | null;
  active: boolean;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

@Injectable()
export class DeliveryDriversService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  private resolveTenantId(actor: DeliveryDriverActor) {
    const tenantId = actor.tenantId?.trim();
    if (!tenantId) {
      throw new UnauthorizedException("Tenant no encontrado en la sesion");
    }
    return tenantId;
  }

  private normalizeNullableText(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private normalizeRequiredText(value: string | undefined, message: string) {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException(message);
    }
    return normalized;
  }

  private async hasDriverCatalogTable() {
    const result = await this.db.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'delivery_drivers'
        ) AS exists
      `
    );

    return Boolean(result.rows[0]?.exists);
  }

  private async assertDriverCatalogTable() {
    if (!(await this.hasDriverCatalogTable())) {
      throw new BadRequestException(
        "Migracion de repartidores pendiente: ejecute V066__delivery_drivers.sql"
      );
    }
  }

  private mapRecord(record: DeliveryDriverRecord) {
    return {
      id: record.id,
      tenant_id: record.tenant_id,
      name: record.name,
      phone: record.phone,
      document_number: record.document_number,
      active: record.active,
      notes: record.notes,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
  }

  async list(filters: QueryDeliveryDriversDto, actor: DeliveryDriverActor) {
    const tenantId = this.resolveTenantId(actor);
    if (!(await this.hasDriverCatalogTable())) {
      return [];
    }

    const params: unknown[] = [tenantId];
    const conditions = ["tenant_id = $1"];

    if (filters.active !== undefined) {
      params.push(filters.active);
      conditions.push(`active = $${params.length}`);
    }

    const query = this.normalizeNullableText(filters.query);
    if (query) {
      params.push(`%${query.toLowerCase()}%`);
      conditions.push(
        `(lower(name) LIKE $${params.length} OR lower(COALESCE(phone, '')) LIKE $${params.length} OR lower(COALESCE(document_number, '')) LIKE $${params.length})`
      );
    }

    const result = await this.db.query<DeliveryDriverRecord>(
      `
        SELECT
          id,
          tenant_id,
          name,
          phone,
          document_number,
          active,
          notes,
          created_at,
          updated_at
        FROM public.delivery_drivers
        WHERE ${conditions.join(" AND ")}
        ORDER BY active DESC, lower(name) ASC, created_at DESC
      `,
      params
    );

    return result.rows.map((record) => this.mapRecord(record));
  }

  async create(payload: CreateDeliveryDriverDto, actor: DeliveryDriverActor) {
    const tenantId = this.resolveTenantId(actor);
    await this.assertDriverCatalogTable();
    const name = this.normalizeRequiredText(payload.name, "name es requerido");

    const result = await this.db.query<DeliveryDriverRecord>(
      `
        INSERT INTO public.delivery_drivers (
          tenant_id,
          name,
          phone,
          document_number,
          active,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        tenantId,
        name,
        this.normalizeNullableText(payload.phone),
        this.normalizeNullableText(payload.document_number),
        payload.active ?? true,
        this.normalizeNullableText(payload.notes),
      ]
    );

    return this.mapRecord(result.rows[0]);
  }

  async getById(id: string, actor: DeliveryDriverActor) {
    const tenantId = this.resolveTenantId(actor);
    await this.assertDriverCatalogTable();
    const result = await this.db.query<DeliveryDriverRecord>(
      `
        SELECT *
        FROM public.delivery_drivers
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1
      `,
      [id, tenantId]
    );

    const driver = result.rows[0];
    if (!driver) {
      throw new NotFoundException("Repartidor no encontrado");
    }

    return this.mapRecord(driver);
  }

  async update(
    id: string,
    payload: UpdateDeliveryDriverDto,
    actor: DeliveryDriverActor
  ) {
    const tenantId = this.resolveTenantId(actor);
    await this.assertDriverCatalogTable();
    const params: unknown[] = [];
    const assignments: string[] = [];

    const addAssignment = (column: string, value: unknown) => {
      params.push(value);
      assignments.push(`${column} = $${params.length}`);
    };

    if (payload.name !== undefined) {
      addAssignment("name", this.normalizeRequiredText(payload.name, "name es requerido"));
    }
    if (payload.phone !== undefined) {
      addAssignment("phone", this.normalizeNullableText(payload.phone));
    }
    if (payload.document_number !== undefined) {
      addAssignment(
        "document_number",
        this.normalizeNullableText(payload.document_number)
      );
    }
    if (payload.active !== undefined) {
      addAssignment("active", payload.active);
    }
    if (payload.notes !== undefined) {
      addAssignment("notes", this.normalizeNullableText(payload.notes));
    }

    if (assignments.length === 0) {
      throw new BadRequestException("No hay campos editables para actualizar");
    }

    assignments.push("updated_at = now()");
    params.push(id);
    const idParam = params.length;
    params.push(tenantId);
    const tenantParam = params.length;

    const result = await this.db.query<DeliveryDriverRecord>(
      `
        UPDATE public.delivery_drivers
        SET ${assignments.join(", ")}
        WHERE id = $${idParam}
          AND tenant_id = $${tenantParam}
        RETURNING *
      `,
      params
    );

    const updated = result.rows[0];
    if (!updated) {
      throw new NotFoundException("Repartidor no encontrado");
    }

    return this.mapRecord(updated);
  }

  async deactivate(id: string, actor: DeliveryDriverActor) {
    const tenantId = this.resolveTenantId(actor);
    await this.assertDriverCatalogTable();
    const result = await this.db.query<DeliveryDriverRecord>(
      `
        UPDATE public.delivery_drivers
        SET active = false,
            updated_at = now()
        WHERE id = $1
          AND tenant_id = $2
        RETURNING *
      `,
      [id, tenantId]
    );

    const updated = result.rows[0];
    if (!updated) {
      throw new NotFoundException("Repartidor no encontrado");
    }

    return this.mapRecord(updated);
  }
}
