import type { AuthProfile, AuthTokens } from "./types";
import type { ForgotPasswordDto, LoginDto } from "./dtos";
import { apiClient } from "../../lib/http";
import { requestJson } from "../../lib/request";
import { clearSession } from "./session-manager";
import { getStoredRefreshToken } from "./session";
import type { MenuResponse } from "../menu/types";

export const login = (payload: LoginDto) =>
  requestJson<AuthTokens>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const forceLogin = (payload: LoginDto) =>
  requestJson<AuthTokens>("/auth/login/force", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const fetchMenu = () => apiClient<MenuResponse>("/me/menu");

export const fetchProfile = () => apiClient<AuthProfile>("/auth/me");

export type UpdateProfilePayload = {
  persona?: {
    nombres?: string | null;
    apellidos?: string | null;
    documentoTipo?: string | null;
    documentoNumero?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    emailPersonal?: string | null;
    cargoNombre?: string | null;
    cargoDescripcion?: string | null;
    funcionesDescripcion?: string | null;
  };
};

export const updateProfile = (
  payload: UpdateProfilePayload,
  headers?: HeadersInit
) =>
  apiClient<{ ok: boolean }>("/auth/me", {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });

export const updatePassword = (password: string, headers?: HeadersInit) =>
  apiClient<{ ok: boolean }>("/auth/me/password", {
    method: "PATCH",
    headers,
    body: JSON.stringify({ password }),
  });

export const forgotPassword = (payload: ForgotPasswordDto) =>
  requestJson<void>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const logout = async () => {
  try {
    const refreshToken = getStoredRefreshToken();
    await requestJson<{ ok: true }>("/auth/logout", {
      method: "POST",
      credentials: "include",
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    });
  } catch {
    // Intentionally ignore logout failures to ensure local cleanup.
  } finally {
    clearSession();
  }
};
