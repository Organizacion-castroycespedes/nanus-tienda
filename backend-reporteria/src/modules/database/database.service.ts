import { Injectable } from "@nestjs/common";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import process from "node:process";

@Injectable()
export class DatabaseService {
  private readonly pool: Pool;

  constructor() {
    const password = process.env.DB_PASSWORD;
    if (typeof password !== "string" || password.trim().length === 0) {
      throw new Error("DB_PASSWORD is not set");
    }

    this.pool = new Pool({
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
      database:
        process.env.DB_NAME || process.env.DB_DATABASE || "manustienda-platform",
      user: process.env.DB_USER || process.env.DB_USERNAME || "postgres",
      password,
      ssl:
        process.env.DB_SSL === "true"
          ? { rejectUnauthorized: false }
          : false,
    });
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = []
  ) {
    const client = await this.pool.connect();
    try {
      return await client.query<T>(text, params);
    } finally {
      client.release();
    }
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }
}
