const localhostNames = new Set(["localhost", "127.0.0.1", "::1"]);

export const isLocalEndpoint = (endpointUrl: string): boolean => {
  try {
    const parsed = new URL(endpointUrl);
    return localhostNames.has(parsed.hostname);
  } catch {
    return false;
  }
};

export const assertDianEndpointAllowed = (
  endpointUrl: string,
  allowExternalCalls: boolean
): void => {
  if (!allowExternalCalls && !isLocalEndpoint(endpointUrl)) {
    throw new Error(
      "DIAN endpoint blocked because DIAN_ALLOW_EXTERNAL_CALLS is not true"
    );
  }
};
