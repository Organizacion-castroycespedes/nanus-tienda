import assert from "node:assert/strict";
import test from "node:test";
import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import jwt from "jsonwebtoken";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { ReportUser } from "./report-auth.types";

type TestRequest = {
  headers: Record<string, string>;
  user?: ReportUser;
};

const buildContext = (request: TestRequest) =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  }) as unknown as ExecutionContext;

const restoreEnv = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
};

test("JwtAuthGuard: decodifica JWT valido con claims de API", () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousMockAuth = process.env.REPORTS_ALLOW_MOCK_AUTH;
  process.env.JWT_SECRET = "report-test-secret";
  process.env.REPORTS_ALLOW_MOCK_AUTH = "false";

  try {
    const token = jwt.sign(
      {
        sub: "40000000-0000-0000-0000-000000000001",
        tenant_id: "00000000-0000-0000-0000-000000000001",
        branch_id: "30000000-0000-0000-0000-000000000001",
        roles: ["SUPER_ADMIN"],
        email: "qa@example.test",
      },
      "report-test-secret"
    );
    const request: TestRequest = {
      headers: { authorization: `Bearer ${token}` },
    };

    const allowed = new JwtAuthGuard().canActivate(buildContext(request));

    assert.equal(allowed, true);
    assert.equal(request.user?.id, "40000000-0000-0000-0000-000000000001");
    assert.deepEqual(request.user?.roles, ["SUPER_ADMIN"]);
  } finally {
    restoreEnv("JWT_SECRET", previousSecret);
    restoreEnv("REPORTS_ALLOW_MOCK_AUTH", previousMockAuth);
  }
});

test("JwtAuthGuard: usa actor mock cuando Bearer es invalido y mock auth esta permitido", () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousMockAuth = process.env.REPORTS_ALLOW_MOCK_AUTH;
  process.env.JWT_SECRET = "report-test-secret";
  delete process.env.REPORTS_ALLOW_MOCK_AUTH;

  try {
    const request: TestRequest = {
      headers: {
        authorization: "Bearer not-a-valid-jwt",
        "x-report-role": "SUPER_ADMIN",
      },
    };

    const allowed = new JwtAuthGuard().canActivate(buildContext(request));

    assert.equal(allowed, true);
    assert.equal(request.user?.id, "40000000-0000-0000-0000-000000000001");
    assert.deepEqual(request.user?.roles, ["SUPER_ADMIN"]);
  } finally {
    restoreEnv("JWT_SECRET", previousSecret);
    restoreEnv("REPORTS_ALLOW_MOCK_AUTH", previousMockAuth);
  }
});

test("JwtAuthGuard: conserva x-report-user-id UUID en actor mock", () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousMockAuth = process.env.REPORTS_ALLOW_MOCK_AUTH;
  process.env.JWT_SECRET = "report-test-secret";
  delete process.env.REPORTS_ALLOW_MOCK_AUTH;

  try {
    const request: TestRequest = {
      headers: {
        authorization: "Bearer not-a-valid-jwt",
        "x-report-user-id": "50000000-0000-0000-0000-000000000001",
        "x-report-branch-id": "30000000-0000-0000-0000-000000000001",
      },
    };

    const allowed = new JwtAuthGuard().canActivate(buildContext(request));

    assert.equal(allowed, true);
    assert.equal(request.user?.id, "50000000-0000-0000-0000-000000000001");
    assert.equal(request.user?.branchId, "30000000-0000-0000-0000-000000000001");
  } finally {
    restoreEnv("JWT_SECRET", previousSecret);
    restoreEnv("REPORTS_ALLOW_MOCK_AUTH", previousMockAuth);
  }
});

test("JwtAuthGuard: ignora x-report-user-id no UUID para evitar 22P02", () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousMockAuth = process.env.REPORTS_ALLOW_MOCK_AUTH;
  process.env.JWT_SECRET = "report-test-secret";
  delete process.env.REPORTS_ALLOW_MOCK_AUTH;

  try {
    const request: TestRequest = {
      headers: {
        authorization: "Bearer not-a-valid-jwt",
        "x-report-user-id": "report-demo-user",
        "x-report-branch-id": "not-a-uuid",
      },
    };

    const allowed = new JwtAuthGuard().canActivate(buildContext(request));

    assert.equal(allowed, true);
    assert.equal(request.user?.id, "40000000-0000-0000-0000-000000000001");
    assert.equal(request.user?.branchId, null);
  } finally {
    restoreEnv("JWT_SECRET", previousSecret);
    restoreEnv("REPORTS_ALLOW_MOCK_AUTH", previousMockAuth);
  }
});

test("JwtAuthGuard: devuelve UnauthorizedException cuando Bearer es invalido y mock auth esta deshabilitado", () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousMockAuth = process.env.REPORTS_ALLOW_MOCK_AUTH;
  process.env.JWT_SECRET = "report-test-secret";
  process.env.REPORTS_ALLOW_MOCK_AUTH = "false";

  try {
    const request: TestRequest = {
      headers: { authorization: "Bearer not-a-valid-jwt" },
    };

    assert.throws(
      () => new JwtAuthGuard().canActivate(buildContext(request)),
      UnauthorizedException
    );
  } finally {
    restoreEnv("JWT_SECRET", previousSecret);
    restoreEnv("REPORTS_ALLOW_MOCK_AUTH", previousMockAuth);
  }
});
