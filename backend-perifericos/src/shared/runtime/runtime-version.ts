import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type VersionSourceEnvironment = NodeJS.ProcessEnv & {
  PERIPHERALS_VERSION?: string;
  PERIPHERALS_PACKAGE_JSON_PATH?: string;
};

const readVersionFromPackageJson = (path: string): string | null => {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as {
      version?: unknown;
    };
    return typeof parsed.version === "string" && parsed.version.trim()
      ? parsed.version.trim()
      : null;
  } catch {
    return null;
  }
};

export const resolveAgentVersion = (
  environment: VersionSourceEnvironment = process.env,
  packageJsonPaths: string[] = [
    environment.PERIPHERALS_PACKAGE_JSON_PATH ?? "",
    join(process.cwd(), "package.json"),
    join(process.cwd(), "backend-perifericos", "package.json"),
  ].filter(Boolean)
): string => {
  const envVersion = environment.PERIPHERALS_VERSION?.trim();
  if (envVersion) {
    return envVersion;
  }

  for (const path of packageJsonPaths) {
    const version = readVersionFromPackageJson(path);
    if (version) {
      return version;
    }
  }

  return "0.1.0";
};
