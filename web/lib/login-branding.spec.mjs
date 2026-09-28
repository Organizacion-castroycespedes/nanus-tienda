import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LOGIN_BRANDING,
  resolveLoginBranding,
} from "./login-branding.mjs";

test("uses both configured branding values", () => {
  assert.deepEqual(
    resolveLoginBranding({
      NEXT_PUBLIC_GIN_BG_IMAGE: "/login-bg.png",
      NEXT_PUBLIC_LOGIN_BRAND_NAME: "MANUS POS",
    }),
    { backgroundImage: "/login-bg.png", brandName: "MANUS POS" },
  );
});

test("falls back together when both values are absent", () => {
  assert.deepEqual(resolveLoginBranding({}), DEFAULT_LOGIN_BRANDING);
});

test("does not mix brands when configuration is partial", () => {
  assert.deepEqual(
    resolveLoginBranding({ NEXT_PUBLIC_GIN_BG_IMAGE: "/login-bg.png" }),
    DEFAULT_LOGIN_BRANDING,
  );
  assert.deepEqual(
    resolveLoginBranding({ NEXT_PUBLIC_LOGIN_BRAND_NAME: "MANUS POS" }),
    DEFAULT_LOGIN_BRANDING,
  );
});
