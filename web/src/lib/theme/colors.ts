const HEX_COLOR_REGEX = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
const SHORT_HEX_COLOR_REGEX = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;

export type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export type HslColor = {
  h: number;
  s: number;
  l: number;
};

const clamp = (value: number, min = 0, max = 255) =>
  Math.min(max, Math.max(min, value));

export const normalizeHexColor = (color?: string | null) => {
  if (typeof color !== "string") {
    return null;
  }

  const value = color.trim();
  if (!value) {
    return null;
  }

  if (SHORT_HEX_COLOR_REGEX.test(value)) {
    return value.replace(
      SHORT_HEX_COLOR_REGEX,
      (_, r: string, g: string, b: string) => `#${r}${r}${g}${g}${b}${b}`
    ).toUpperCase();
  }

  if (!HEX_COLOR_REGEX.test(value)) {
    return null;
  }

  return (value.startsWith("#") ? value : `#${value}`).toUpperCase();
};

export const isValidHexColor = (color?: string | null) =>
  normalizeHexColor(color) !== null;

export const hexToRgb = (hex: string): RgbColor | null => {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    return null;
  }

  const match = HEX_COLOR_REGEX.exec(normalized);

  if (!match) {
    return null;
  }

  return {
    r: Number.parseInt(match[1], 16),
    g: Number.parseInt(match[2], 16),
    b: Number.parseInt(match[3], 16),
  };
};

export const hexToHsl = (hex: string): HslColor | null => {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return null;
  }

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    switch (max) {
      case r:
        h = 60 * (((g - b) / delta) % 6);
        break;
      case g:
        h = 60 * ((b - r) / delta + 2);
        break;
      default:
        h = 60 * ((r - g) / delta + 4);
        break;
    }
  }

  return {
    h: h < 0 ? h + 360 : h,
    s,
    l,
  };
};

const rgbToHex = ({ r, g, b }: RgbColor) =>
  `#${[r, g, b]
    .map((channel) => clamp(channel).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();

const mix = (hex: string, target: string, amount: number) => {
  const base = hexToRgb(hex);
  const mixTarget = hexToRgb(target);

  if (!base || !mixTarget) {
    return hex;
  }

  const ratio = Math.min(1, Math.max(0, amount));

  return rgbToHex({
    r: Math.round(base.r + (mixTarget.r - base.r) * ratio),
    g: Math.round(base.g + (mixTarget.g - base.g) * ratio),
    b: Math.round(base.b + (mixTarget.b - base.b) * ratio),
  });
};

const getRelativeLuminance = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return null;
  }

  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

export const getContrastRatio = (foreground: string, background: string) => {
  const foregroundLuminance = getRelativeLuminance(foreground);
  const backgroundLuminance = getRelativeLuminance(background);

  if (foregroundLuminance === null || backgroundLuminance === null) {
    return 1;
  }

  const light = Math.max(foregroundLuminance, backgroundLuminance);
  const dark = Math.min(foregroundLuminance, backgroundLuminance);

  return (light + 0.05) / (dark + 0.05);
};

export const isDarkColor = (hex: string) => {
  const luminance = getRelativeLuminance(hex);
  return luminance === null ? false : luminance < 0.45;
};

export const getContrastColor = (background: string, dark = "#0F172A", light = "#FFFFFF") =>
  getContrastRatio(light, background) >= getContrastRatio(dark, background)
    ? light
    : dark;

export const getReadableTextColor = (
  backgroundColor?: string | null,
  dark = "#0F172A",
  light = "#FFFFFF"
) => {
  const normalized = normalizeHexColor(backgroundColor);
  if (!normalized) {
    return dark;
  }

  return getContrastColor(normalized, dark, light);
};

export const lighten = (hex: string, amount = 0.12) => mix(hex, "#FFFFFF", amount);

export const darken = (hex: string, amount = 0.12) => mix(hex, "#000000", amount);

export const generateHoverColor = (hex: string) =>
  isDarkColor(hex) ? lighten(hex, 0.14) : darken(hex, 0.1);
