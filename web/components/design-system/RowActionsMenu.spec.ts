import test from "node:test";
import assert from "node:assert/strict";
import { calculateRowActionsMenuPosition, runRowAction } from "./RowActionsMenu";

test("row action menu stays inside viewport and opens upward near the bottom", () => {
  const position = calculateRowActionsMenuPosition(
    { top: 560, right: 1020, bottom: 592 },
    { innerHeight: 600, innerWidth: 1024 },
  );

  assert.equal(position.openUpward, true);
  assert.equal(position.left, 808);
  assert.equal(position.top, 556);
});

test("row action menu opens below when there is enough space", () => {
  const position = calculateRowActionsMenuPosition(
    { top: 100, right: 240, bottom: 132 },
    { innerHeight: 768, innerWidth: 1024 },
  );

  assert.equal(position.openUpward, false);
  assert.equal(position.left, 32);
  assert.equal(position.top, 136);
});

test("row action closes before its callback", () => {
  const events: string[] = [];

  runRowAction(() => events.push("closed"), () => events.push("executed"));

  assert.deepEqual(events, ["closed", "executed"]);
});

test("row action remains closed when its callback throws", () => {
  let closed = false;

  assert.throws(() => runRowAction(() => { closed = true; }, () => { throw new Error("action failed"); }), /action failed/);
  assert.equal(closed, true);
});

test("row action closes before an asynchronous callback settles", async () => {
  let closed = false;
  let callbackSawClosedMenu = false;

  runRowAction(() => { closed = true; }, async () => {
    callbackSawClosedMenu = closed;
    await Promise.resolve();
  });

  await Promise.resolve();
  assert.equal(callbackSawClosedMenu, true);
});
