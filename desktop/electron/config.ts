//export const DEFAULT_MANUS_WEB_URL = "https://www.apptiendamanus.space/login";
export const DEFAULT_MANUS_WEB_URL = "http://localhost:3000/login";
export const DEFAULT_AGENT_LOOPBACK_ORIGIN = "http://127.0.0.1:4050";
export const QA_MANUS_WEB_ORIGIN = "https://www.apptiendamanus.space";

export type ElectronConfigEnv = {
  MANUS_WEB_URL?: string;
  NEXT_PUBLIC_MANUS_WEB_URL?: string;
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

export type ShellEnvironment = "dev" | "qa" | "production";

export type VersionedShellConfig = {
  environment: Exclude<ShellEnvironment, "dev">;
  frontendUrl: string;
  allowedOrigins: string[];
  agentLoopbackOrigin: string;
};

const LOOPBACK_HOSTS = new Set(["127.0.0.1"]);

const originOf = (value: string): URL => {
  const url = new URL(value);
  if (url.username || url.password || url.hash || url.search) {
    throw new Error("Shell URL must not include credentials, query, or hash");
  }
  return url;
};

export const validateVersionedShellConfig = (
  value: unknown,
): VersionedShellConfig => {
  if (!value || typeof value !== "object") {
    throw new Error("Shell config must be an object");
  }

  const candidate = value as Record<string, unknown>;
  const environment = candidate.environment;
  if (environment !== "qa" && environment !== "production") {
    throw new Error("Shell config environment is not allowed");
  }

  if (typeof candidate.frontendUrl !== "string") {
    throw new Error("Shell config frontendUrl is required");
  }
  const frontend = originOf(candidate.frontendUrl);
  if (frontend.protocol !== "https:") {
    throw new Error("Packaged frontendUrl must use HTTPS");
  }

  if (!Array.isArray(candidate.allowedOrigins) || candidate.allowedOrigins.length === 0) {
    throw new Error("Shell config allowedOrigins is required");
  }
  const allowedOrigins = candidate.allowedOrigins.map((origin) => {
    if (typeof origin !== "string") {
      throw new Error("Shell config origin must be a string");
    }
    const parsed = originOf(origin);
    return parsed.origin;
  });
  if (!allowedOrigins.includes(frontend.origin)) {
    throw new Error("frontendUrl origin must be allowlisted");
  }

  if (typeof candidate.agentLoopbackOrigin !== "string") {
    throw new Error("Shell config agentLoopbackOrigin is required");
  }
  const agent = originOf(candidate.agentLoopbackOrigin);
  if (agent.protocol !== "http:" || !LOOPBACK_HOSTS.has(agent.hostname) || agent.port !== "4050") {
    throw new Error("agentLoopbackOrigin must be http://127.0.0.1:4050");
  }

  return {
    environment,
    // Keep the configured startup path (for example `/login`) while using
    // only the origin for the allowlist check above.
    frontendUrl: frontend.href,
    allowedOrigins,
    agentLoopbackOrigin: agent.origin,
  };
};

const readTrimmed = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const resolveWebBaseUrl = (env: Pick<ElectronConfigEnv, "MANUS_WEB_URL" | "NEXT_PUBLIC_MANUS_WEB_URL">) => {
  const configuredUrl =
    readTrimmed(env.MANUS_WEB_URL) ??
    readTrimmed(env.NEXT_PUBLIC_MANUS_WEB_URL) ??
    DEFAULT_MANUS_WEB_URL;

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
  const webBaseUrl = resolveWebBaseUrl(env);
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
