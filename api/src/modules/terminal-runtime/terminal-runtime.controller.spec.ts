import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import { PATH_METADATA } from "@nestjs/common/constants";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TerminalRuntimeController } from "./terminal-runtime.controller";

test("runtime resolution is a POST endpoint protected by normal JWT auth", () => {
  assert.equal(Reflect.getMetadata(PATH_METADATA, TerminalRuntimeController), "terminal-runtime");
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, TerminalRuntimeController), [JwtAuthGuard]);
  assert.equal(Reflect.getMetadata(PATH_METADATA, TerminalRuntimeController.prototype.resolve), "resolve");
});
