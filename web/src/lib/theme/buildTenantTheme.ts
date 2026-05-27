import { defaultTheme } from "../../../components/design-system/theme";
import type { BrandingConfig } from "../../../store/brandingSlice";
import {
  darken,
  generateHoverColor,
  getContrastColor,
  getContrastRatio,
  hexToHsl,
  isDarkColor,
  lighten,
} from "./colors";

export type TenantThemeTokens = {
  colors: BrandingConfig["colors"];
  logo?: string;
  font: string;
  spacing: BrandingConfig["spacing"];
  primary: string;
  secondary: string;
  background: string;
  text: string;
  hover: string;
  active: string;
  border: string;
  muted: string;
  contrastText: string;
  surface: {
    page: string;
    card: string;
    text: string;
    mutedText: string;
    border: string;
  };
  sidebar: {
    background: string;
    text: string;
    mutedText: string;
    activeBackground: string;
    activeText: string;
    hoverBackground: string;
    border: string;
    logoBackground: string;
    logoText: string;
    iconBackground: string;
    iconActiveBackground: string;
    subItemActiveBackground: string;
    subItemActiveText: string;
    itemHoverBackground: string;
  };
  header: {
    background: string;
    text: string;
    mutedText: string;
    border: string;
    actionBackground: string;
    actionText: string;
    actionHover: string;
    iconButtonBackground: string;
    iconButtonBorder: string;
    iconButtonText: string;
  };
};

const SAFE_PAGE_BACKGROUND = "#F8FAFC";
const SAFE_CARD_BACKGROUND = "#FFFFFF";
const SAFE_SURFACE_TEXT = "#0F172A";
const SAFE_SURFACE_MUTED = "#475569";
const SAFE_SURFACE_BORDER = "#E2E8F0";
const SAFE_ACTIVE_BLUE = "#2563EB";
const SAFE_SIDEBAR_BACKGROUND = "#0B1220";

const ensureReadableText = (preferred: string, background: string) =>
  getContrastRatio(preferred, background) >= 4.5
    ? preferred
    : getContrastColor(background);

const isAggressiveBackground = (hex: string) => {
  const hsl = hexToHsl(hex);
  if (!hsl) {
    return true;
  }

  const isBrightYellow = hsl.h >= 42 && hsl.h <= 72 && hsl.s >= 0.45 && hsl.l >= 0.55;
  const isAggressiveHue =
    ((hsl.h >= 0 && hsl.h <= 25) ||
      (hsl.h >= 45 && hsl.h <= 75) ||
      (hsl.h >= 100 && hsl.h <= 150) ||
      (hsl.h >= 190 && hsl.h <= 250)) &&
    hsl.s >= 0.55 &&
    hsl.l >= 0.38 &&
    hsl.l <= 0.82;

  return isBrightYellow || isAggressiveHue || isDarkColor(hex);
};

export const getSafePageBackground = (input: string) => {
  const hsl = hexToHsl(input);
  if (!hsl) {
    return SAFE_PAGE_BACKGROUND;
  }

  const nearWhite = hsl.l >= 0.94 && hsl.s <= 0.15;
  return nearWhite && !isDarkColor(input) ? input : SAFE_PAGE_BACKGROUND;
};

export const getSafeSidebarBackground = (secondary: string) => {
  const hsl = hexToHsl(secondary);
  if (!hsl) {
    return SAFE_SIDEBAR_BACKGROUND;
  }

  const usableDark =
    hsl.l <= 0.2 &&
    hsl.s <= 0.65 &&
    !(hsl.h <= 18 && hsl.s >= 0.4) &&
    !(hsl.h >= 340 && hsl.s >= 0.35);

  return usableDark ? secondary : SAFE_SIDEBAR_BACKGROUND;
};

export const getSafeActiveColor = (primary: string) => {
  const hsl = hexToHsl(primary);
  if (!hsl) {
    return SAFE_ACTIVE_BLUE;
  }

  const tooLight = hsl.l >= 0.72;
  const tooYellow = hsl.h >= 42 && hsl.h <= 72 && hsl.s >= 0.35;
  const tooNeon = hsl.s >= 0.82 && hsl.l >= 0.52;

  return tooLight || tooYellow || tooNeon ? SAFE_ACTIVE_BLUE : primary;
};

export const buildTenantTheme = (branding: BrandingConfig): TenantThemeTokens => {
  const colors = {
    primary: branding.colors.primary || defaultTheme.colors.primary,
    secondary: branding.colors.secondary || defaultTheme.colors.secondary,
    background: branding.colors.background || defaultTheme.colors.background,
    text: branding.colors.text || defaultTheme.colors.text,
  };

  const brandPrimary = getSafeActiveColor(colors.primary);
  const brandSecondary = getSafeSidebarBackground(colors.secondary);
  const brandBackground = getSafePageBackground(colors.background);
  const surfaceText = SAFE_SURFACE_TEXT;
  const surfaceMuted = SAFE_SURFACE_MUTED;
  const surfaceBorder = SAFE_SURFACE_BORDER;
  const sidebarBackground = brandSecondary;
  const sidebarText = ensureReadableText("#E2E8F0", sidebarBackground);
  const sidebarActiveText = ensureReadableText("#FFFFFF", brandPrimary);
  const sidebarHoverBackground = isDarkColor(sidebarBackground)
    ? lighten(sidebarBackground, 0.08)
    : darken(sidebarBackground, 0.08);
  const sidebarBorder = isDarkColor(sidebarBackground)
    ? lighten(sidebarBackground, 0.12)
    : darken(sidebarBackground, 0.12);

  return {
    colors,
    logo: branding.logoUrl ?? branding.logo,
    font: branding.font || defaultTheme.typography.fontFamily,
    spacing: branding.spacing,
    primary: brandPrimary,
    secondary: brandSecondary,
    background: brandBackground,
    text: surfaceText,
    hover: sidebarHoverBackground,
    active: brandPrimary,
    border: surfaceBorder,
    muted: surfaceMuted,
    contrastText: ensureReadableText("#FFFFFF", brandPrimary),
    surface: {
      page: SAFE_PAGE_BACKGROUND,
      card: SAFE_CARD_BACKGROUND,
      text: surfaceText,
      mutedText: surfaceMuted,
      border: surfaceBorder,
    },
    sidebar: {
      background: sidebarBackground,
      text: sidebarText,
      mutedText: lighten(sidebarText, 0.18),
      activeBackground: brandPrimary,
      activeText: sidebarActiveText,
      hoverBackground: sidebarHoverBackground,
      border: sidebarBorder,
      logoBackground: getContrastColor(sidebarBackground, "#E2E8F0", "#FFFFFF"),
      logoText: getContrastColor(getContrastColor(sidebarBackground, "#E2E8F0", "#FFFFFF")),
      iconBackground: "rgba(255,255,255,0.08)",
      iconActiveBackground: "rgba(255,255,255,0.16)",
      subItemActiveBackground: `color-mix(in srgb, ${brandPrimary} 14%, transparent)`,
      subItemActiveText: ensureReadableText(brandPrimary, "#FFFFFF"),
      itemHoverBackground: sidebarHoverBackground,
    },
    header: {
      background: SAFE_CARD_BACKGROUND,
      text: surfaceText,
      mutedText: "#64748B",
      border: surfaceBorder,
      actionBackground: brandPrimary,
      actionText: ensureReadableText("#FFFFFF", brandPrimary),
      actionHover: generateHoverColor(brandPrimary),
      iconButtonBackground: SAFE_CARD_BACKGROUND,
      iconButtonBorder: surfaceBorder,
      iconButtonText: surfaceText,
    },
  };
};
