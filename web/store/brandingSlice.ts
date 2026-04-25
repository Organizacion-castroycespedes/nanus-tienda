import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { defaultTheme } from "../components/design-system/theme";

export type BrandingConfig = {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
  };
  font: string;
  logo?: string;
  spacing: {
    sm: string;
    md: string;
    lg: string;
  };
};

export type BrandingState = {
  config: BrandingConfig;
};

const initialState: BrandingState = {
  config: {
    colors: {
      primary: defaultTheme.colors.primary,
      secondary: defaultTheme.colors.secondary,
      background: defaultTheme.colors.background,
      text: defaultTheme.colors.text,
    },
    font: defaultTheme.typography.fontFamily,
    spacing: {
      sm: defaultTheme.spacing.sm,
      md: defaultTheme.spacing.md,
      lg: defaultTheme.spacing.lg,
    },
  },
};

const brandingSlice = createSlice({
  name: "branding",
  initialState,
  reducers: {
    setBranding(state, action: PayloadAction<Partial<BrandingConfig>>) {
      state.config = {
        ...state.config,
        ...action.payload,
        colors: {
          ...state.config.colors,
          ...(action.payload.colors ?? {}),
        },
        spacing: {
          ...state.config.spacing,
          ...(action.payload.spacing ?? {}),
        },
      };
    },
    resetBranding(state) {
      state.config = initialState.config;
    },
  },
});

export const { setBranding, resetBranding } = brandingSlice.actions;
export default brandingSlice.reducer;
