import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveJwtExpiresIn,
  resolveJwtSecret,
  resolveRefreshTokenExpiresDays,
} from "./auth-env";

const withEnv = (values: Record<string, string | undefined>, run: () => void) => {
  const previousValues = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(values)) {
    previousValues.set(key, process.env[key]);
    process.env[key] = value ?? "";
  }

  try {
    run();
  } finally {
    for (const [key, value] of previousValues) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

test("resolveJwtSecret: uses configured JWT_SECRET", () => {
  withEnv(
    {
      JWT_SECRET: "unit-test-secret",
      NODE_ENV: "production",
    },
    () => {
      assert.equal(resolveJwtSecret(), "unit-test-secret");
    },
  );
});

test("resolveJwtSecret: blocks insecure fallback outside explicit local/test", () => {
  withEnv(
    {
      JWT_SECRET: "",
      NODE_ENV: "production",
    },
    () => {
      assert.throws(() => resolveJwtSecret(), /JWT_SECRET is required/);
    },
  );
});

test("resolveJwtSecret: allows fallback only in explicit local/test", () => {
  withEnv(
    {
      JWT_SECRET: "",
      NODE_ENV: "local",
    },
    () => {
      assert.equal(resolveJwtSecret(), "changeme");
    },
  );
});

test("auth env resolver: keeps compatible defaults for token durations", () => {
  withEnv(
    {
      JWT_EXPIRES_IN: "",
      REFRESH_TOKEN_EXPIRES_DAYS: "0",
    },
    () => {
      assert.equal(resolveJwtExpiresIn(), "15m");
      assert.equal(resolveRefreshTokenExpiresDays(), 30);
    },
  );
});
