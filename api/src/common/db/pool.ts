import { Pool, QueryResultRow } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = async <T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> => {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    if (process.env.DB_LOGGING === "true") {
      const durationMs = Date.now() - start;
      console.info("db.query", {
        durationMs,
        rows: result.rowCount ?? result.rows.length,
      });
    }
    return result.rows;
  } catch (error) {
    const durationMs = Date.now() - start;
    console.error("db.query.error", {
      durationMs,
      text,
      paramsCount: params.length,
      error,
    });
    throw error;
  }
};
