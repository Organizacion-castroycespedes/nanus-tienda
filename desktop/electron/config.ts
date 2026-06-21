export const DEFAULT_MANUS_WEB_URL = "http://localhost:3000";

export type ElectronConfigEnv = {
  MANUS_WEB_URL?: string;
  MANUS_START_PATH?: string;
  MANUS_TENANT_ID?: string;
  MANUS_BRANCH_ID?: string;
  MANUS_TERMINAL_ID?: string;
};

export type ElectronOperationalContext = {
  webBaseUrl: URL;
  startPath: string | null;
  tenantId: string | null;
  branchId: string | null;
  terminalId: string | null;
  initialUrl: URL;
};

const readTrimmed = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const resolveWebBaseUrl = (value: string | undefined) => {
  const configuredUrl = readTrimmed(value) ?? DEFAULT_MANUS_WEB_URL;

  try {
    return new URL(configuredUrl);
  } catch {
    return new URL(DEFAULT_MANUS_WEB_URL);
  }
};

const resolveStartPath = (value: string | undefined) => {
  const startPath = readTrimmed(value);

  if (!startPath) {
    return null;
  }

  if (!startPath.startsWith("/") || startPath.startsWith("//")) {
    throw new Error("MANUS_START_PATH must start with a single /");
  }

  return startPath;
};

const buildTenantStartPath = (tenantId: string | null) => {
  return tenantId ? `/${encodeURIComponent(tenantId)}` : null;
};

export const resolveElectronConfig = (
  env: ElectronConfigEnv = process.env
): ElectronOperationalContext => {
  const webBaseUrl = resolveWebBaseUrl(env.MANUS_WEB_URL);
  const startPath = resolveStartPath(env.MANUS_START_PATH);
  const tenantId = readTrimmed(env.MANUS_TENANT_ID);
  const branchId = readTrimmed(env.MANUS_BRANCH_ID);
  const terminalId = readTrimmed(env.MANUS_TERMINAL_ID);
  const initialPath = startPath ?? buildTenantStartPath(tenantId);
  const initialUrl = initialPath ? new URL(initialPath, webBaseUrl) : webBaseUrl;

  return {
    webBaseUrl,
    startPath,
    tenantId,
    branchId,
    terminalId,
    initialUrl,
  };
};
