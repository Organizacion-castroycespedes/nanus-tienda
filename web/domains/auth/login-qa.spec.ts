import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isQaLoginEnabled } from "./login-qa";

describe("isQaLoginEnabled", () => {
  it("disables qa login by default", () => {
    assert.equal(isQaLoginEnabled("localhost"), false);
  });

  it("requires explicit enable flag", () => {
    assert.equal(isQaLoginEnabled("localhost", "false"), false);
  });

  it("allows localhost when enabled", () => {
    assert.equal(isQaLoginEnabled("localhost", "true"), true);
  });

  it("blocks non-local hosts even when enabled", () => {
    assert.equal(isQaLoginEnabled("app.example.com", "true"), false);
  });
});
