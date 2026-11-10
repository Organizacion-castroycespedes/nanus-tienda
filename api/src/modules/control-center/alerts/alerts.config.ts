export type AlertsConfig = {
  alertsEnabled: boolean;
  emailEnabled: boolean;
  smtp: {
    host: string | null;
    port: number;
    secure: boolean;
    user: string | null;
    password: string | null;
  };
  from: string | null;
  paymentInstructions: string | null;
  /** Variables que faltan para enviar correo (nunca incluye valores). */
  missing: string[];
  emailReady: boolean;
};

type Env = Record<string, string | undefined>;

const clean = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const flag = (value: string | undefined) => clean(value)?.toLowerCase() === "true";

export const readAlertsConfig = (env: Env = process.env): AlertsConfig => {
  const host = clean(env.CONTROL_CENTER_SMTP_HOST);
  const portRaw = Number(clean(env.CONTROL_CENTER_SMTP_PORT) ?? "587");
  const port = Number.isInteger(portRaw) && portRaw > 0 && portRaw < 65536 ? portRaw : 587;
  const user = clean(env.CONTROL_CENTER_SMTP_USER);
  const password = env.CONTROL_CENTER_SMTP_PASSWORD && env.CONTROL_CENTER_SMTP_PASSWORD.length > 0 ? env.CONTROL_CENTER_SMTP_PASSWORD : null;
  const from = clean(env.CONTROL_CENTER_ALERTS_FROM);
  const emailEnabled = flag(env.CONTROL_CENTER_ALERTS_EMAIL_ENABLED);
  const missing: string[] = [];
  if (!host) missing.push("CONTROL_CENTER_SMTP_HOST");
  if (!from) missing.push("CONTROL_CENTER_ALERTS_FROM");
  if (user && !password) missing.push("CONTROL_CENTER_SMTP_PASSWORD");
  const instructions = clean(env.CONTROL_CENTER_PAYMENT_INSTRUCTIONS);
  return {
    alertsEnabled: flag(env.CONTROL_CENTER_ALERTS_ENABLED),
    emailEnabled,
    smtp: { host, port, secure: env.CONTROL_CENTER_SMTP_SECURE === undefined ? port === 465 : flag(env.CONTROL_CENTER_SMTP_SECURE), user, password },
    from,
    paymentInstructions: instructions ? instructions.replace(/\\n/g, "\n") : null,
    missing,
    emailReady: emailEnabled && missing.length === 0,
  };
};
