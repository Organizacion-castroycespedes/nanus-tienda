"use client";

import { useMemo } from "react";
import { useAppSelector } from "../store/hooks";
import { buildTenantTheme } from "../src/lib/theme/buildTenantTheme";

export const useTenantTheme = () => {
  const branding = useAppSelector((state) => state.branding.config);

  return useMemo(() => {
    const theme = buildTenantTheme(branding);

    return {
      primary: theme.primary,
      primaryText: theme.primaryText,
      primarySoftBg: theme.primarySoftBg,
      primaryBorder: theme.primaryBorder,
      secondary: theme.secondary,
      secondaryText: theme.secondaryText,
      secondarySoftBg: theme.secondarySoftBg,
      secondaryBorder: theme.secondaryBorder,
      appBackground: theme.appBackground,
      background: theme.background,
      text: theme.text,
      hover: theme.hover,
      active: theme.active,
      border: theme.border,
      muted: theme.muted,
      contrastText: theme.contrastText,
      colors: theme.colors,
      logo: theme.logo,
      font: theme.font,
      spacing: theme.spacing,
      sidebar: theme.sidebar,
      menu: theme.menu,
      header: theme.header,
      surface: theme.surface,
    };
  }, [branding]);
};
