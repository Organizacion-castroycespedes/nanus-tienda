export const decodeJwt = <T>(token: string): T | null => {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload)) as T;
  } catch {
    return null;
  }
};
