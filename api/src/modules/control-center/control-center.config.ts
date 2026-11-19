export const DEFAULT_PLATFORM_TENANT_ID = "00000000-0000-0000-0000-000000000001";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ControlCenterDisabledReason =
  | "FLAG_DISABLED"
  | "CREDENTIALS_MISSING"
  | "PLATFORM_TENANT_INVALID";

export type ControlCenterConfig = {
  enabled: boolean;
  disabledReason: ControlCenterDisabledReason | null;
  username: string | null;
  password: string | null;
  platformTenantId: string;
};

type Env = Record<string, string | undefined>;

const clean = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const readControlCenterConfig = (env: Env = process.env): ControlCenterConfig => {
  const flag = clean(env.CONTROL_CENTER_ENABLED)?.toLowerCase() === "true";
  const username = clean(env.CONTROL_CENTER_DB_USERNAME);
  const password = env.CONTROL_CENTER_DB_PASSWORD ?? null;
  const platformTenantId = clean(env.PLATFORM_TENANT_ID) ?? DEFAULT_PLATFORM_TENANT_ID;

  let disabledReason: ControlCenterDisabledReason | null = null;
  if (!flag) {
    disabledReason = "FLAG_DISABLED";
  } else if (!username || !password) {
    disabledReason = "CREDENTIALS_MISSING";
  } else if (!UUID_PATTERN.test(platformTenantId)) {
    disabledReason = "PLATFORM_TENANT_INVALID";
  }

  return {
    enabled: disabledReason === null,
    disabledReason,
    username,
    password: password && password.length > 0 ? password : null,
    platformTenantId,
  };
};
