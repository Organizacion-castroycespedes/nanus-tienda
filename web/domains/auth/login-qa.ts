const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1", "::1"]);

export const isQaLoginEnabled = (
  hostname: string,
  enabledFlag?: string | null
) => {
  return enabledFlag === "true" && LOCALHOST_NAMES.has(hostname);
};
