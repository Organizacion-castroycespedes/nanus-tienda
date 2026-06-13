import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { ReportAuthzGuard } from "./report-authz.guard";
import type { ReportUser } from "./report-auth.types";

type TestRequest = {
  user?: ReportUser;
};

const buildContext = (request: TestRequest) =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  }) as unknown as ExecutionContext;

const baseUser: ReportUser = {
  id: "40000000-0000-0000-0000-000000000001",
  tenantId: "00000000-0000-0000-0000-000000000001",
  branchId: "30000000-0000-0000-0000-000000000001",
  roles: ["ADMIN"],
  email: "qa@example.test",
};

test("ReportAuthzGuard: permite roles administrativos de reporteria", () => {
  const request: TestRequest = {
    user: baseUser,
  };

  assert.equal(new ReportAuthzGuard().canActivate(buildContext(request)), true);
});

test("ReportAuthzGuard: bloquea USER en reportes", () => {
  const request: TestRequest = {
    user: {
      ...baseUser,
      roles: ["USER"],
    },
  };

  assert.throws(
    () => new ReportAuthzGuard().canActivate(buildContext(request)),
    ForbiddenException
  );
});

test("ReportAuthzGuard: bloquea actor sin tenant", () => {
  const request: TestRequest = {
    user: {
      ...baseUser,
      tenantId: "",
    },
  };

  assert.throws(
    () => new ReportAuthzGuard().canActivate(buildContext(request)),
    ForbiddenException
  );
});
