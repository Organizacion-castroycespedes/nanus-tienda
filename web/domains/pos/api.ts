import { apiClient } from "../../lib/http";
import type {
  AuthContextResponse,
  CreatePosSessionPayload,
  CreatePosSessionResponse,
} from "./types";

export const getAuthContext = () => apiClient<AuthContextResponse>("/auth/context");

export const createPosSession = (payload: CreatePosSessionPayload) =>
  apiClient<CreatePosSessionResponse>("/pos/session", {
    method: "POST",
    body: JSON.stringify(payload),
  });
