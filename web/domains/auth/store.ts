import type { AuthUser } from "./types";

export type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
};

export const initialAuthState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
};
