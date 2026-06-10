import * as dotenv from "dotenv";
import * as path from "path";

let envLoaded = false;

const uniquePaths = (paths: string[]) => Array.from(new Set(paths));

export const loadApiEnv = () => {
  if (envLoaded) {
    return;
  }

  const apiRoot = path.resolve(__dirname, "../../..");
  const envPaths = uniquePaths([
    path.resolve(process.cwd(), ".env"),
    path.resolve(apiRoot, ".env"),
  ]);

  for (const envPath of envPaths) {
    dotenv.config({ path: envPath, quiet: true });
  }

  envLoaded = true;
};
