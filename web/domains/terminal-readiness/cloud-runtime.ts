import { apiClient } from "../../lib/http";
import type { TerminalRuntimeResolution } from "./contracts";
export const resolveTerminalRuntime = (installationId: string) => apiClient<TerminalRuntimeResolution>("/terminal-runtime/resolve", { method: "POST", body: JSON.stringify({ installationId }) });
