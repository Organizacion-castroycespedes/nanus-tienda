import assert from "node:assert/strict";
import test from "node:test";
import { canSeeBillingNotices, dismissKey, formatNoticeAmount, noticeMessage, noticeTone, type BillingNotice } from "./notices";

const notice: BillingNotice = {
  id: "n1",
  chargeNumber: "MCC-COB-2026-000001",
  stage: "OVERDUE_7",
  dueDate: "2026-11-08",
  balance: "850000.00",
  currency: "COP",
  periodStart: "2026-11-08",
  periodEnd: "2027-11-07",
  updatedAt: "2026-11-15T00:00:00Z",
};

test("only tenant administrators see billing notices", () => {
  assert.equal(canSeeBillingNotices("ADMIN"), true);
  assert.equal(canSeeBillingNotices("super_admin"), true);
  assert.equal(canSeeBillingNotices("SUPER_USER"), true);
  assert.equal(canSeeBillingNotices("USER"), false);
  assert.equal(canSeeBillingNotices(undefined), false);
});

test("messages and tones by stage", () => {
  assert.equal(noticeMessage(notice, "2026-11-15"), "Tu pago con MANUS está vencido hace 7 días: cargo MCC-COB-2026-000001 por $850.000.");
  assert.equal(noticeMessage(notice, "2026-11-08"), "Tu pago con MANUS vence hoy: cargo MCC-COB-2026-000001 por $850.000.");
  assert.match(noticeMessage(notice, "2026-11-03"), /vence el 08\/11\/2026/);
  assert.equal(noticeTone("UPCOMING"), "info");
  assert.equal(noticeTone("DUE"), "warning");
  assert.equal(noticeTone("OVERDUE_30"), "danger");
  assert.equal(formatNoticeAmount("1200000.00"), "$1.200.000");
});

test("dismissal key changes when stage or balance changes", () => {
  assert.notEqual(dismissKey([notice]), dismissKey([{ ...notice, stage: "OVERDUE_15" }]));
  assert.notEqual(dismissKey([notice]), dismissKey([{ ...notice, balance: "1.00" }]));
});
