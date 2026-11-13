import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { readControlCenterConfig, type ControlCenterConfig } from "./control-center.config";
import { CONTROL_CENTER_DISABLED_CODE } from "./control-center.constants";

/** Cualquier ejecutor de consultas: el pool dedicado o un PoolClient en transaccion. */
export type ControlCenterQueryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
};

/**
 * Pool dedicado del Control Center. Usa el rol de base de datos propio
 * (CONTROL_CENTER_DB_*) y nunca el DatabaseService operativo.
 */
@Injectable()
export class ControlCenterDatabaseService implements OnModuleDestroy {
  private readonly config: ControlCenterConfig;
  private pool: Pool | null = null;

  constructor() {
    this.config = readControlCenterConfig();
  }

  isEnabled() {
    return this.config.enabled;
  }

  getConfig(): Readonly<ControlCenterConfig> {
    return this.config;
  }

  assertEnabled() {
    if (!this.config.enabled) {
      throw new ServiceUnavailableException({
        code: CONTROL_CENTER_DISABLED_CODE,
        message: "Control Center deshabilitado",
      });
    }
  }

  private getPool(): Pool {
    this.assertEnabled();
    if (!this.pool) {
      this.pool = new Pool({
        user: this.config.username ?? undefined,
        password: this.config.password ?? undefined,
        host: process.env.DB_HOST || "localhost",
        database: process.env.DB_DATABASE,
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
        max: 5,
        application_name: "manus-control-center",
        statement_timeout: 15000,
      });
      this.pool.on("error", (error) => {
        console.error("[control-center] PostgreSQL pool error:", error.message);
      });
    }
    return this.pool;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<{ rows: T[] }> {
    const result = await this.getPool().query<T>(text, params);
    return { rows: result.rows };
  }

  /** Conexión dedicada sin transacción (por ejemplo, para bloqueos consultivos de sesión). */
  async withClient<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getPool().connect();
    try {
      return await work(client);
    } finally {
      client.release();
    }
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end().catch(() => undefined);
      this.pool = null;
    }
  }
}
