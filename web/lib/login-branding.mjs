export const DEFAULT_LOGIN_BRANDING = Object.freeze({
  backgroundImage: "/logo-login-tablet.png",
  brandName: "EMAUS POS",
});

const readValue = (value) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
};

export const resolveLoginBranding = (env = {}) => {
  const backgroundImage = readValue(env.LOGIN_BG_IMAGE);
  const brandName = readValue(env.LOGIN_BRAND_NAME);

  if (backgroundImage && brandName) {
    return { backgroundImage, brandName };
  }

  return { ...DEFAULT_LOGIN_BRANDING };
};
