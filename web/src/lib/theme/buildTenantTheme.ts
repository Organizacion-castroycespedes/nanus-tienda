import { defaultTheme } from "../../../components/design-system/theme";
import type { BrandingConfig } from "../../../store/brandingSlice";
import {
  darken,
  generateHoverColor,
  getContrastColor,
  getContrastRatio,
  getReadableTextColor,
  hexToHsl,
  isDarkColor,
  lighten,
  normalizeHexColor,
} from "./colors";

type CssValue = string | number;

export type TenantThemeTokens = {
  colors: BrandingConfig["colors"];
  logo?: string;
  font: string;
  spacing: BrandingConfig["spacing"];
  primary: string;
  primaryText: string;
  primarySoftBg: string;
  primaryBorder: string;
  secondary: string;
  secondaryText: string;
  secondarySoftBg: string;
  secondaryBorder: string;
  appBackground: string;
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
    subItemActiveIndicator: string;
    itemHoverBackground: string;
    activeIndicator: string;
    focusRing: string;
    focusRingOffset: string;
  };
  menu: {
    background: string;
    text: string;
    mutedText: string;
    border: string;
    activeBg: string;
    activeText: string;
    activeIndicator: string;
    hoverBg: string;
    subActiveBg: string;
    subActiveText: string;
    subActiveIndicator: string;
    iconBg: string;
    iconActiveBg: string;
    focusRing: string;
    focusRingOffset: string;
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
const MIN_STATE_BACKGROUND_CONTRAST = 1.28;
const MIN_INDICATOR_CONTRAST = 3;

const ensureReadableText = (preferred: string, background: string) =>
  getContrastRatio(preferred, background) >= 4.5
    ? preferred
    : getReadableTextColor(background);

const normalizeColorOrFallback = (value: string, fallback: string) =>
  normalizeHexColor(value) ?? fallback;

const getSoftTint = (color: string, amount = 0.9) => {
  const normalized = normalizeHexColor(color);
  if (!normalized) {
    return SAFE_PAGE_BACKGROUND;
  }

  return lighten(normalized, amount);
};

const getBorderTint = (color: string, amount = 0.64) => {
  const normalized = normalizeHexColor(color);
  if (!normalized) {
    return SAFE_SURFACE_BORDER;
  }

  return lighten(normalized, amount);
};

const isNearWhiteSurface = (color: string) => {
  const hsl = hexToHsl(color);
  return hsl ? hsl.l >= 0.94 : false;
};

const isUsableStateBackground = (
  candidate: string,
  background: string,
  isDarkBackground: boolean
) => {
  const normalized = normalizeHexColor(candidate);
  if (!normalized) {
    return false;
  }

  if (!isDarkBackground && isNearWhiteSurface(normalized)) {
    return false;
  }

  return getContrastRatio(normalized, background) >= MIN_STATE_BACKGROUND_CONTRAST;
};

const pickStateBackground = (
  candidates: string[],
  background: string,
  fallback: string,
  isDarkBackground: boolean
) => {
  const usable = candidates.find((candidate) =>
    isUsableStateBackground(candidate, background, isDarkBackground)
  );

  if (usable) {
    return normalizeHexColor(usable) ?? fallback;
  }

  return normalizeHexColor(fallback) ?? SAFE_ACTIVE_BLUE;
};

const ensureVisibleAccent = (
  preferred: string,
  background: string,
  fallback = SAFE_ACTIVE_BLUE
) => {
  const normalizedPreferred = normalizeHexColor(preferred);
  if (
    normalizedPreferred &&
    getContrastRatio(normalizedPreferred, background) >= MIN_INDICATOR_CONTRAST
  ) {
    return normalizedPreferred;
  }

  const normalizedFallback = normalizeHexColor(fallback) ?? SAFE_ACTIVE_BLUE;
  if (getContrastRatio(normalizedFallback, background) >= MIN_INDICATOR_CONTRAST) {
    return normalizedFallback;
  }

  return getReadableTextColor(background);
};

export const getSafePageBackground = (input: string) => {
  const normalized = normalizeHexColor(input);
  if (!normalized) {
    return SAFE_PAGE_BACKGROUND;
  }

  const hsl = hexToHsl(normalized);
  if (!hsl) {
    return SAFE_PAGE_BACKGROUND;
  }

  const usableSurface = hsl.l >= 0.92 && hsl.s <= 0.28 && !isDarkColor(normalized);
  return usableSurface ? normalized : SAFE_PAGE_BACKGROUND;
};

export const getSafeSidebarBackground = (secondary: string) => {
  const normalized = normalizeHexColor(secondary);
  if (!normalized) {
    return SAFE_SIDEBAR_BACKGROUND;
  }

  const hsl = hexToHsl(normalized);
  if (!hsl) {
    return SAFE_SIDEBAR_BACKGROUND;
  }

  const usableDark =
    hsl.l <= 0.2 &&
    hsl.s <= 0.65 &&
    !(hsl.h <= 18 && hsl.s >= 0.4) &&
    !(hsl.h >= 340 && hsl.s >= 0.35);
  const usableLightSurface = hsl.l >= 0.94 && hsl.s <= 0.5;

  return usableDark || usableLightSurface ? normalized : SAFE_SIDEBAR_BACKGROUND;
};

export const getSafeActiveColor = (primary: string) => {
  const normalized = normalizeHexColor(primary);
  if (!normalized) {
    return SAFE_ACTIVE_BLUE;
  }

  const hsl = hexToHsl(normalized);
  if (!hsl) {
    return SAFE_ACTIVE_BLUE;
  }

  const tooLight = hsl.l >= 0.72;
  const tooYellow = hsl.h >= 42 && hsl.h <= 72 && hsl.s >= 0.35;
  const tooNeon = hsl.s >= 0.82 && hsl.l >= 0.52;

  return tooLight || tooYellow || tooNeon ? SAFE_ACTIVE_BLUE : normalized;
};

export const buildTenantTheme = (branding: BrandingConfig): TenantThemeTokens => {
  const colors = {
    primary: normalizeColorOrFallback(
      branding.colors.primary,
      defaultTheme.colors.primary
    ),
    secondary: normalizeColorOrFallback(
      branding.colors.secondary,
      defaultTheme.colors.secondary
    ),
    background: normalizeColorOrFallback(
      branding.colors.background,
      defaultTheme.colors.background
    ),
    text: normalizeColorOrFallback(branding.colors.text, defaultTheme.colors.text),
  };

  const brandPrimary = getSafeActiveColor(colors.primary);
  const brandSecondary = colors.secondary;
  const brandBackground = getSafePageBackground(colors.background);
  const primaryText = ensureReadableText("#FFFFFF", brandPrimary);
  const primarySoftBg = getSoftTint(brandPrimary, 0.9);
  const primaryBorder = getBorderTint(brandPrimary, 0.64);
  const secondaryText = ensureReadableText("#FFFFFF", brandSecondary);
  const secondarySoftBg = getSoftTint(brandSecondary, 0.9);
  const secondaryBorder = getBorderTint(brandSecondary, 0.64);
  const surfaceText = ensureReadableText(colors.text, brandBackground);
  const surfaceMuted = getContrastRatio(SAFE_SURFACE_MUTED, brandBackground) >= 4.5
    ? SAFE_SURFACE_MUTED
    : getReadableTextColor(brandBackground);
  const surfaceBorder = SAFE_SURFACE_BORDER;
  const menuBackground = getSafeSidebarBackground(brandSecondary);
  const menuIsDark = isDarkColor(menuBackground);
  const menuText = ensureReadableText(menuIsDark ? "#E2E8F0" : SAFE_SURFACE_TEXT, menuBackground);
  const menuMutedText = menuIsDark ? lighten(menuText, 0.18) : SAFE_SURFACE_MUTED;
  const menuPrimary =
    getContrastRatio(brandPrimary, menuBackground) >= (menuIsDark ? 2.2 : 1.4)
      ? brandPrimary
      : SAFE_ACTIVE_BLUE;
  const menuAccent =
    getContrastRatio(brandSecondary, menuBackground) >= 3
      ? brandSecondary
      : menuPrimary;
  const menuActiveBg = menuIsDark
    ? menuPrimary
    : pickStateBackground(
        [
          getSoftTint(menuPrimary, 0.76),
          getSoftTint(menuPrimary, 0.82),
          primarySoftBg,
        ],
        menuBackground,
        getSoftTint(SAFE_ACTIVE_BLUE, 0.76),
        menuIsDark
      );
  const menuActiveText = ensureReadableText(
    menuIsDark ? "#FFFFFF" : SAFE_SURFACE_TEXT,
    menuActiveBg
  );
  const menuHoverBg = menuIsDark
    ? lighten(menuBackground, 0.1)
    : darken(menuBackground, 0.05);
  const menuBorder = menuIsDark
    ? lighten(menuBackground, 0.12)
    : darken(menuBackground, 0.12);
  const menuActiveIndicator = ensureVisibleAccent(menuPrimary, menuBackground);
  const menuSubActiveIndicator = ensureVisibleAccent(
    menuAccent,
    menuBackground,
    menuActiveIndicator
  );
  const menuSubActiveBg = menuIsDark
    ? pickStateBackground(
        [
          lighten(menuBackground, 0.2),
          lighten(menuBackground, 0.26),
          lighten(menuBackground, 0.32),
        ],
        menuBackground,
        lighten(SAFE_SIDEBAR_BACKGROUND, 0.26),
        menuIsDark
      )
    : pickStateBackground(
        [
          getSoftTint(menuAccent, 0.78),
          getSoftTint(menuPrimary, 0.8),
          getSoftTint(SAFE_ACTIVE_BLUE, 0.78),
        ],
        menuBackground,
        getSoftTint(SAFE_ACTIVE_BLUE, 0.78),
        menuIsDark
      );
  const menuSubActiveText = ensureReadableText(
    menuIsDark ? "#F8FAFC" : SAFE_SURFACE_TEXT,
    menuSubActiveBg
  );
  const menuFocusRing = ensureVisibleAccent(
    menuAccent,
    menuBackground,
    menuActiveIndicator
  );
  const sidebarBackground = menuBackground;
  const sidebarText = menuText;
  const sidebarActiveText = menuActiveText;
  const sidebarAccent = menuActiveIndicator;
  const sidebarHoverBackground = menuHoverBg;
  const sidebarBorder = menuBorder;

  return {
    colors,
    logo: branding.logoUrl ?? branding.logo,
    font: branding.font || defaultTheme.typography.fontFamily,
    spacing: branding.spacing,
    primary: brandPrimary,
    primaryText,
    primarySoftBg,
    primaryBorder,
    secondary: brandSecondary,
    secondaryText,
    secondarySoftBg,
    secondaryBorder,
    appBackground: brandBackground,
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
      mutedText: menuMutedText,
      activeBackground: menuActiveBg,
      activeText: sidebarActiveText,
      hoverBackground: sidebarHoverBackground,
      border: sidebarBorder,
      logoBackground: getContrastColor(sidebarBackground, "#E2E8F0", "#FFFFFF"),
      logoText: getContrastColor(getContrastColor(sidebarBackground, "#E2E8F0", "#FFFFFF")),
      iconBackground: menuIsDark ? "rgba(255,255,255,0.08)" : "#F8FAFC",
      iconActiveBackground: menuIsDark ? "rgba(255,255,255,0.16)" : primarySoftBg,
      subItemActiveBackground: menuSubActiveBg,
      subItemActiveText: menuSubActiveText,
      subItemActiveIndicator: menuSubActiveIndicator,
      itemHoverBackground: sidebarHoverBackground,
      activeIndicator: sidebarAccent,
      focusRing: menuFocusRing,
      focusRingOffset: sidebarBackground,
    },
    menu: {
      background: sidebarBackground,
      text: sidebarText,
      mutedText: menuMutedText,
      border: sidebarBorder,
      activeBg: menuActiveBg,
      activeText: sidebarActiveText,
      activeIndicator: sidebarAccent,
      hoverBg: sidebarHoverBackground,
      subActiveBg: menuSubActiveBg,
      subActiveText: menuSubActiveText,
      subActiveIndicator: menuSubActiveIndicator,
      iconBg: menuIsDark ? "rgba(255,255,255,0.08)" : "#F8FAFC",
      iconActiveBg: menuIsDark ? "rgba(255,255,255,0.16)" : primarySoftBg,
      focusRing: menuFocusRing,
      focusRingOffset: sidebarBackground,
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

export const buildTenantThemeTokens = buildTenantTheme;

export type MenuItemStateInput = {
  depth?: number;
  isActive?: boolean;
  hasActiveChild?: boolean;
};

export type MenuItemStateStyles = {
  container: Record<string, CssValue>;
  indicator: Record<string, CssValue>;
  icon: Record<string, CssValue>;
  chevron: Record<string, CssValue>;
};

export const getMenuItemStateStyles = (
  themeTokens: TenantThemeTokens,
  state: MenuItemStateInput
): MenuItemStateStyles => {
  const depth = state.depth ?? 0;
  const isSubItem = depth > 0;
  const isActive = Boolean(state.isActive);
  const hasActiveChild = Boolean(state.hasActiveChild);
  const isVisuallyActive = isActive || hasActiveChild;

  const activeChildBackground = isSubItem
    ? "transparent"
    : themeTokens.menu.subActiveBg;

  return {
    container: {
      backgroundColor: isActive
        ? isSubItem
          ? themeTokens.menu.subActiveBg
          : themeTokens.menu.activeBg
        : hasActiveChild
          ? activeChildBackground
          : "transparent",
      color: isVisuallyActive
        ? isSubItem
          ? themeTokens.menu.subActiveText
          : themeTokens.menu.activeText
        : themeTokens.menu.text,
      boxShadow: isActive
        ? isSubItem
          ? `inset 0 0 0 1px ${themeTokens.menu.subActiveIndicator}`
          : "0 10px 24px rgba(15, 23, 42, 0.22)"
        : "none",
    },
    indicator: {
      backgroundColor: isActive
        ? isSubItem
          ? themeTokens.menu.subActiveIndicator
          : themeTokens.menu.activeIndicator
        : hasActiveChild
          ? themeTokens.menu.activeBg
          : themeTokens.menu.activeIndicator,
      opacity: isActive ? 1 : hasActiveChild ? 0.72 : 0,
      width: isActive ? 3 : 2,
    },
    icon: {
      backgroundColor: isSubItem
        ? isActive
          ? themeTokens.menu.subActiveIndicator
          : themeTokens.menu.mutedText
        : isVisuallyActive
          ? themeTokens.menu.iconActiveBg
          : themeTokens.menu.iconBg,
      color: isVisuallyActive
        ? isSubItem
          ? themeTokens.menu.subActiveText
          : themeTokens.menu.activeText
        : themeTokens.menu.text,
      opacity: isSubItem && !isVisuallyActive ? 0.72 : 1,
    },
    chevron: {
      color: isVisuallyActive
        ? isSubItem
          ? themeTokens.menu.subActiveText
          : themeTokens.menu.activeText
        : themeTokens.menu.mutedText,
    },
  };
};
