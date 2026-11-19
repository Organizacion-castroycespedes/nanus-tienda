import assert from "node:assert/strict";
import test from "node:test";
import { daysFromDue, manualStageFor, stageFor } from "./alert-stages";
import { readAlertsConfig } from "./alerts.config";

test("days from due date across months", () => {
  assert.equal(daysFromDue("2026-12-08", "2026-12-03"), -5);
  assert.equal(daysFromDue("2026-12-08", "2026-12-08"), 0);
  assert.equal(daysFromDue("2026-11-30", "2026-12-07"), 7);
});

test("stage thresholds: 5 days before, due day and 1/7/15/30 days overdue", () => {
  assert.equal(stageFor(-6), null);
  assert.equal(stageFor(-5), "UPCOMING");
  assert.equal(stageFor(-1), "UPCOMING");
  assert.equal(stageFor(0), "DUE");
  assert.equal(stageFor(1), "OVERDUE_1");
  assert.equal(stageFor(6), "OVERDUE_1");
  assert.equal(stageFor(7), "OVERDUE_7");
  assert.equal(stageFor(8), "OVERDUE_7");
  assert.equal(stageFor(15), "OVERDUE_15");
  assert.equal(stageFor(30), "OVERDUE_30");
  assert.equal(stageFor(45), "OVERDUE_30");
});

test("manual reminder uses the current stage or the upcoming one", () => {
  assert.equal(manualStageFor(-20), "UPCOMING");
  assert.equal(manualStageFor(3), "OVERDUE_1");
});

test("alerts config: off by default and reports missing SMTP variables", () => {
  const config = readAlertsConfig({});
  assert.equal(config.alertsEnabled, false);
  assert.equal(config.emailEnabled, false);
  assert.equal(config.emailReady, false);
  assert.deepEqual(config.missing, ["CONTROL_CENTER_SMTP_HOST", "CONTROL_CENTER_ALERTS_FROM"]);
  assert.equal(config.smtp.port, 587);
  assert.equal(config.smtp.secure, false);
});

test("alerts config: ready with host, sender and credentials; 465 implies TLS", () => {
  const config = readAlertsConfig({
    CONTROL_CENTER_ALERTS_ENABLED: "true",
    CONTROL_CENTER_ALERTS_EMAIL_ENABLED: "true",
    CONTROL_CENTER_SMTP_HOST: "smtp-relay.brevo.com",
    CONTROL_CENTER_SMTP_PORT: "465",
    CONTROL_CENTER_SMTP_USER: "user",
    CONTROL_CENTER_SMTP_PASSWORD: "secret",
    CONTROL_CENTER_ALERTS_FROM: "MANUS <cobros@manus.co>",
    CONTROL_CENTER_PAYMENT_INSTRUCTIONS: "Bancolombia ahorros 123\\nNequi 300",
  });
  assert.equal(config.emailReady, true);
  assert.equal(config.smtp.secure, true);
  assert.equal(config.paymentInstructions, "Bancolombia ahorros 123\nNequi 300");
  const missingPassword = readAlertsConfig({ CONTROL_CENTER_SMTP_HOST: "h", CONTROL_CENTER_ALERTS_FROM: "a@b.co", CONTROL_CENTER_SMTP_USER: "u" });
  assert.deepEqual(missingPassword.missing, ["CONTROL_CENTER_SMTP_PASSWORD"]);
});
