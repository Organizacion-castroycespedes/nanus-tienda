import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseConfig } from "../src/config/database.config";

test("database config uses postgres env conventions", () => {
  const config = getDatabaseConfig({
    DB_HOST: "db.example.local",
    DB_PORT: "6432",
    DB_DATABASE: "billing_db",
    DB_USERNAME: "billing_user",
    DB_PASSWORD: "secret",
    DB_SSL: "true",
    DB_LOGGING: "yes",
    DB_POOL_MAX: "20",
  });

  assert.equal(config.host, "db.example.local");
  assert.equal(config.port, 6432);
  assert.equal(config.database, "billing_db");
  assert.equal(config.username, "billing_user");
  assert.equal(config.password, "secret");
  assert.equal(config.ssl, true);
  assert.equal(config.logging, true);
  assert.equal(config.poolMax, 20);
});

test("database config falls back to safe defaults", () => {
  const config = getDatabaseConfig({});

  assert.equal(config.host, "localhost");
  assert.equal(config.port, 5432);
  assert.equal(config.database, "manus_tienda_electronic_billing");
  assert.equal(config.username, "postgres");
  assert.equal(config.password, "");
  assert.equal(config.ssl, false);
  assert.equal(config.logging, false);
  assert.equal(config.poolMax, 10);
});
