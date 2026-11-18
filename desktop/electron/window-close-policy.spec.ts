import assert from "node:assert/strict";
import test from "node:test";

import { handleWindowClose, parseCloseBehavior } from "./window-close-policy.js";

const createEvent = () => {
  let prevented = false;
  return {
    preventDefault: () => { prevented = true; },
    wasPrevented: () => prevented,
  };
};

test("close behavior defaults to quit and only accepts the explicit hide value", () => {
  assert.equal(parseCloseBehavior(undefined), "quit");
  assert.equal(parseCloseBehavior("invalid"), "quit");
  assert.equal(parseCloseBehavior("hide"), "hide");
});

test("quit requests the normal app quit lifecycle and lets its second close through", () => {
  let isQuitting = false;
  let quitCalls = 0;
  let hideCalls = 0;
  const quit = () => {
    quitCalls += 1;
    isQuitting = true;
  };
  const window = { hide: () => { hideCalls += 1; } };
  const firstEvent = createEvent();

  assert.equal(handleWindowClose("quit", isQuitting, false, firstEvent, window, quit), "quit");
  assert.equal(firstEvent.wasPrevented(), true);

  const secondEvent = createEvent();
  assert.equal(handleWindowClose("quit", isQuitting, false, secondEvent, window, quit), "allow");
  assert.equal(secondEvent.wasPrevented(), false);
  assert.equal(quitCalls, 1);
  assert.equal(hideCalls, 0);
});

test("hide prevents destruction and keeps the application running", () => {
  let quitCalls = 0;
  let hideCalls = 0;
  const event = createEvent();

  assert.equal(handleWindowClose("hide", false, false, event, { hide: () => { hideCalls += 1; } }, () => { quitCalls += 1; }), "hide");
  assert.equal(event.wasPrevented(), true);
  assert.equal(hideCalls, 1);
  assert.equal(quitCalls, 0);
});

test("already-authorized shutdown and maintenance closes pass through", () => {
  for (const [isQuitting, maintenanceExitAllowed] of [[true, false], [false, true]] as const) {
    const event = createEvent();
    let quitCalls = 0;
    let hideCalls = 0;

    assert.equal(handleWindowClose("quit", isQuitting, maintenanceExitAllowed, event, { hide: () => { hideCalls += 1; } }, () => { quitCalls += 1; }), "allow");
    assert.equal(event.wasPrevented(), false);
    assert.equal(quitCalls, 0);
    assert.equal(hideCalls, 0);
  }
});

test("duplicate close requests during the quit transition do not recurse", () => {
  let isQuitting = false;
  let quitCalls = 0;
  let closeRequests = 0;
  const window = { hide: () => assert.fail("quit behavior must not hide") };
  const requestClose = (): void => {
    const requestNumber = ++closeRequests;
    const event = createEvent();
    const action = handleWindowClose("quit", isQuitting, false, event, window, () => {
      quitCalls += 1;
      isQuitting = true;
      requestClose();
    });
    if (requestNumber === 1) {
      assert.equal(action, "quit");
      assert.equal(event.wasPrevented(), true);
    } else {
      assert.equal(action, "allow");
      assert.equal(event.wasPrevented(), false);
    }
  };

  requestClose();

  assert.equal(closeRequests, 2);
  assert.equal(quitCalls, 1);
});
