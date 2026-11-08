import { apiClient } from "../../lib/http";
import type { ControlCenterReadiness } from "./types";

export const getControlCenterReadiness = (signal?: AbortSignal) =>
  apiClient<ControlCenterReadiness>("/admin/control-center/readiness", {
    method: "GET",
    signal,
  });
