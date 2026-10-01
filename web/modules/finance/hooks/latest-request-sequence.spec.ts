import assert from "node:assert/strict";
import test from "node:test";
import { createLatestRequestSequence } from "./latest-request-sequence";

test("independent request sequences do not invalidate each other", () => {
  const historyRequests = createLatestRequestSequence();
  const openSessionRequests = createLatestRequestSequence();

  const historyRequestId = historyRequests.next();
  openSessionRequests.next();

  assert.equal(historyRequests.isCurrent(historyRequestId), true);
});

test("a newer request invalidates an older request in the same sequence", () => {
  const requests = createLatestRequestSequence();
  const firstRequestId = requests.next();
  const secondRequestId = requests.next();

  assert.equal(requests.isCurrent(firstRequestId), false);
  assert.equal(requests.isCurrent(secondRequestId), true);
});
