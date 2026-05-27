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
      secondary: theme.secondary,
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
      header: theme.header,
      surface: theme.surface,
    };
  }, [branding]);
};
