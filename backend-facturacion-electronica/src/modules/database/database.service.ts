import { Injectable, OnApplicationShutdown, OnModuleDestroy, Optional } from "@nestjs/common";
import {
  Pool,
  type PoolClient,
  type PoolConfig,
  type QueryResult,
  type QueryResultRow,
} from "pg";
import { getDatabaseConfig, type DatabaseConfig } from "../../config/database.config";

type DatabaseClient = Pick<PoolClient, "query" | "release">;
type DatabasePool = Pick<Pool, "connect" | "end">;

export type DatabaseServiceOptions = {
  config?: DatabaseConfig;
  poolFactory?: (config: DatabaseConfig) => DatabasePool;
};

const createPoolConfig = (config: DatabaseConfig): PoolConfig => ({
  host: config.host,
  port: config.port,
  database: config.database,
  user: config.username,
  password: config.password,
  ssl: config.ssl ? { rejectUnauthorized: false } : false,
  max: config.poolMax,
  application_name: "backend-facturacion-electronica",
});

const createDefaultPool = (config: DatabaseConfig): Pool => {
  if (config.password.trim().length === 0) {
    throw new Error("DB_PASSWORD is not set");
  }

  return new Pool(createPoolConfig(config));
};

@Injectable()
export class DatabaseService
  implements OnModuleDestroy, OnApplicationShutdown
{
  private readonly config: DatabaseConfig;
  private readonly poolFactory: (config: DatabaseConfig) => DatabasePool;
  private pool: DatabasePool | null = null;

  constructor(@Optional() options: DatabaseServiceOptions = {}) {
    this.config = options?.config ?? getDatabaseConfig();
    this.poolFactory = options?.poolFactory ?? createDefaultPool;
  }

  private getPool(): DatabasePool {
    if (this.pool) {
      return this.pool;
    }

    this.pool = this.poolFactory(this.config);
    if ("on" in this.pool) {
      (this.pool as Pool).on("error", (error) => {
        console.error("PostgreSQL pool error:", error);
      });
    }
    return this.pool;
  }

  private async withClient<T>(
    runner: (client: DatabaseClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getPool().connect();

    try {
      return await runner(client);
    } finally {
      client.release();
    }
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: readonly unknown[] = []
  ): Promise<QueryResult<T>> {
    return this.withClient<QueryResult<T>>((client) =>
      client.query<T>(text, params as unknown[])
    );
  }

  async getClient(): Promise<PoolClient> {
    return this.getPool().connect();
  }

  async transaction<T>(
    runner: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getPool().connect();

    try {
      await client.query("BEGIN");
      const result = await runner(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Keep original error.
      }

      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    if (!this.pool) {
      return;
    }

    await this.pool.end();
    this.pool = null;
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }

  getConnectionConfig(): DatabaseConfig {
    return { ...this.config };
  }
}
