import { apiClient } from "../../lib/http";
import type {
  AuthContextResponse,
  CreatePosSessionPayload,
  CreatePosSessionResponse,
  CurrentPosSessionResponse,
} from "./types";

export const getAuthContext = () => apiClient<AuthContextResponse>("/auth/context");

export const createPosSession = (payload: CreatePosSessionPayload) =>
  apiClient<CreatePosSessionResponse>("/pos/session", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getCurrentPosSession = () =>
  apiClient<CurrentPosSessionResponse | null>("/pos/session/current");
