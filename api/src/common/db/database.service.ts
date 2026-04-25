import { Injectable } from "@nestjs/common";
import * as process from "process";
import { Pool } from "pg";

@Injectable()
export class DatabaseService {
  private readonly pool: Pool;

  constructor() {
    const password = process.env.DB_PASSWORD;
    if (typeof password !== "string" || password.length === 0) {
      throw new Error(
        "DB_PASSWORD is not set. Define it in apps/api/.env or your shell environment.",
      );
    }

    this.pool = new Pool({
      user: process.env.DB_USERNAME || 'postgres', // Default to 'postgres' if not set
      host: process.env.DB_HOST || 'localhost', // Default to localhost if not set
      database: process.env.DB_DATABASE || 'tenantcore-platform',
      password,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432, // Default PostgreSQL port
      ssl: process.env.DB_SSL === 'true'
                  ? { rejectUnauthorized: false }
                  : false,
                  });
  }
  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } catch (error){
      console.error('Error executing query:', error);
      throw error; // Rethrow the error to propagate it up the chain
    } finally {
      client.release();
    }
  }

  async getClient() {
    return await this.pool.connect();
  }
}

