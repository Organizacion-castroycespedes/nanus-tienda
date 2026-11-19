import assert from "node:assert/strict";
import test from "node:test";
import { getRoutePermissionRequirement } from "../../lib/route-permissions";
import { MENU_KEYS } from "../menu/constants";
import {
  DEFAULT_PLATFORM_TENANT_ID,
  canSeeControlCenter,
  classifyControlCenterError,
} from "./access";

const platform = DEFAULT_PLATFORM_TENANT_ID;

test("control center route requires the CONTROL_CENTER menu permission", () => {
  assert.deepEqual(getRoutePermissionRequirement("/manus/control-center"), {
    module: MENU_KEYS.CONTROL_CENTER,
    action: "read",
  });
  for (const path of ["/manus/control-center/accounts", "/manus/control-center/contracts/abc"]) {
    assert.deepEqual(getRoutePermissionRequirement(path), { module: MENU_KEYS.CONTROL_CENTER, action: "read" });
  }
});

test("only SUPER_ADMIN of the platform tenant with menu access sees the Control Center", () => {
  assert.equal(
    canSeeControlCenter({ role: "SUPER_ADMIN", tenantId: platform, hasReadAccess: true, platformTenantId: platform }),
    true,
  );
  assert.equal(
    canSeeControlCenter({ role: "SUPER_ADMIN", tenantId: "other", hasReadAccess: true, platformTenantId: platform }),
    false,
  );
  for (const role of ["SUPER_USER", "ADMIN", "USER", ""]) {
    assert.equal(
      canSeeControlCenter({ role, tenantId: platform, hasReadAccess: true, platformTenantId: platform }),
      false,
    );
  }
  assert.equal(
    canSeeControlCenter({ role: "SUPER_ADMIN", tenantId: platform, hasReadAccess: false, platformTenantId: platform }),
    false,
  );
});

test("backend responses map to UI states", () => {
  assert.equal(classifyControlCenterError(401), "UNAUTHORIZED");
  assert.equal(classifyControlCenterError(403), "UNAUTHORIZED");
  assert.equal(classifyControlCenterError(503, "CONTROL_CENTER_DISABLED"), "DISABLED");
  assert.equal(classifyControlCenterError(503), "UNAVAILABLE");
  assert.equal(classifyControlCenterError(500), "UNAVAILABLE");
});
