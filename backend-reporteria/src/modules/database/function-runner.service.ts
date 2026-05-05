import { Inject, Injectable } from "@nestjs/common";
import type { QueryResultRow } from "pg";
import { DatabaseService } from "./database.service";

@Injectable()
export class FunctionRunnerService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService
  ) {}

  private assertSafeFunctionName(name: string) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error("Unsafe SQL function name");
    }
  }

  async executeFunction<T = unknown>(
    name: string,
    params: unknown[] = []
  ): Promise<T> {
    this.assertSafeFunctionName(name);

    const placeholders =
      params.length === 0
        ? ""
        : params.map((_, index) => `$${index + 1}`).join(", ");

    const result = await this.databaseService.query<QueryResultRow & { result: T }>(
      `SELECT ${name}(${placeholders}) AS result`,
      params
    );

    return result.rows[0]?.result as T;
  }
}
