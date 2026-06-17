import assert from "node:assert/strict";
import test from "node:test";
import type { BrandingConfig } from "../../../store/brandingSlice";
import {
  buildTenantThemeTokens,
  getMenuItemStateStyles,
} from "./buildTenantTheme";
import { getContrastRatio, hexToHsl } from "./colors";

const branding = (colors: Partial<BrandingConfig["colors"]>): BrandingConfig => ({
  colors: {
    primary: colors.primary ?? "#1D4ED8",
    secondary: colors.secondary ?? "#0F172A",
    background: colors.background ?? "#F8FAFC",
    text: colors.text ?? "#0F172A",
  },
  font: "Inter, system-ui, sans-serif",
  spacing: {
    sm: "8px",
    md: "16px",
    lg: "24px",
  },
});

const assertReadable = (foreground: string, background: string) => {
  assert.ok(
    getContrastRatio(foreground, background) >= 4.5,
    `${foreground} is not readable on ${background}`
  );
};

const assertDifferentStateBg = (stateBackground: string, menuBackground: string) => {
  assert.notEqual(stateBackground, menuBackground);
  assert.ok(
    getContrastRatio(stateBackground, menuBackground) >= 1.28,
    `${stateBackground} is too close to ${menuBackground}`
  );
};

const assertClearSubmenuStateBg = (
  stateBackground: string,
  menuBackground: string
) => {
  assert.notEqual(stateBackground, menuBackground);
  assert.ok(
    getContrastRatio(stateBackground, menuBackground) >= 1.45,
    `${stateBackground} is not visible enough against ${menuBackground}`
  );
};

const assertNotNearWhite = (color: string) => {
  const hsl = hexToHsl(color);
  assert.ok(hsl && hsl.l < 0.94, `${color} is too close to white`);
};

test("builds isolated tenant tokens from each branding config", () => {
  const tenantA = buildTenantThemeTokens(
    branding({ primary: "#1D4ED8", secondary: "#111827" })
  );
  const tenantB = buildTenantThemeTokens(
    branding({ primary: "#047857", secondary: "#172554" })
  );

  assert.notEqual(tenantA.sidebar.activeBackground, tenantB.sidebar.activeBackground);
  assert.notEqual(tenantA.primarySoftBg, tenantB.primarySoftBg);
  assert.notEqual(tenantA.secondarySoftBg, tenantB.secondarySoftBg);
});

test("falls back when tenant colors are invalid", () => {
  const tokens = buildTenantThemeTokens(
    branding({
      primary: "not-a-color",
      secondary: "bad",
      background: "nope",
      text: "also-bad",
    })
  );

  assert.equal(tokens.colors.primary, "#1A73E8");
  assert.equal(tokens.background, "#F8FAFC");
  assert.equal(tokens.text, "#0F172A");
  assert.equal(tokens.appBackground, "#F8FAFC");
  assert.equal(tokens.primaryText, "#FFFFFF");
});

test("keeps strong tenant backgrounds from saturating app surfaces", () => {
  const tokens = buildTenantThemeTokens(
    branding({ background: "#EF4444", text: "#FFFFFF" })
  );

  assert.equal(tokens.appBackground, "#F8FAFC");
  assert.equal(tokens.surface.page, "#F8FAFC");
});

test("returns readable active and submenu menu styles", () => {
  const tokens = buildTenantThemeTokens(
    branding({ primary: "#1D4ED8", secondary: "#0F172A" })
  );
  const active = getMenuItemStateStyles(tokens, { isActive: true });
  const submenu = getMenuItemStateStyles(tokens, { depth: 1, isActive: true });

  assert.equal(active.container.backgroundColor, tokens.menu.activeBg);
  assert.equal(active.container.color, tokens.menu.activeText);
  assert.equal(submenu.container.color, tokens.menu.subActiveText);
  assert.equal(submenu.indicator.backgroundColor, tokens.menu.subActiveIndicator);
  assert.equal(active.indicator.opacity, 1);
});

test("keeps parent active strong when no child is active", () => {
  const tokens = buildTenantThemeTokens(
    branding({ primary: "#2563EB", secondary: "#0F172A" })
  );
  const parentActive = getMenuItemStateStyles(tokens, {
    depth: 0,
    isActive: true,
    hasActiveChild: false,
  });

  assert.equal(parentActive.container.backgroundColor, tokens.menu.activeBg);
  assert.equal(parentActive.container.color, tokens.menu.activeText);
  assert.equal(parentActive.indicator.backgroundColor, tokens.menu.activeIndicator);
  assert.equal(parentActive.indicator.opacity, 1);
});

test("keeps parent open contextual when child is active", () => {
  const tokens = buildTenantThemeTokens(
    branding({ primary: "#2563EB", secondary: "#0F172A" })
  );
  const parentOpen = getMenuItemStateStyles(tokens, {
    depth: 0,
    isOpen: true,
    hasActiveChild: true,
  });

  assert.equal(parentOpen.container.backgroundColor, tokens.menu.openBg);
  assert.equal(parentOpen.container.color, tokens.menu.openText);
  assert.equal(parentOpen.indicator.backgroundColor, tokens.menu.openIndicator);
  assert.notEqual(parentOpen.container.backgroundColor, tokens.menu.activeBg);
  assert.notEqual(parentOpen.container.color, tokens.menu.activeText);
});

test("promotes active child to the strong active style", () => {
  const tokens = buildTenantThemeTokens(
    branding({ primary: "#2563EB", secondary: "#0F172A" })
  );
  const parentOpen = getMenuItemStateStyles(tokens, {
    depth: 0,
    isOpen: true,
    hasActiveChild: true,
  });
  const childActive = getMenuItemStateStyles(tokens, {
    depth: 1,
    isActive: true,
    promoteActive: true,
  });

  assert.notEqual(
    parentOpen.container.backgroundColor,
    childActive.container.backgroundColor
  );
  assert.equal(childActive.container.backgroundColor, tokens.menu.activeBg);
  assert.equal(childActive.container.color, tokens.menu.activeText);
  assert.equal(childActive.indicator.backgroundColor, tokens.menu.activeIndicator);
  assert.equal(childActive.icon.backgroundColor, tokens.menu.activeIndicator);
  assert.equal(childActive.container.boxShadow, "none");
  assertReadable(
    String(childActive.container.color),
    String(childActive.container.backgroundColor)
  );
  assert.ok(
    getContrastRatio(
      String(childActive.container.backgroundColor),
      tokens.menu.background
    ) >
      getContrastRatio(
        String(parentOpen.container.backgroundColor),
        tokens.menu.background
      )
  );
});

test("keeps dark sidebar active and submenu states visible", () => {
  const tokens = buildTenantThemeTokens(
    branding({ primary: "#DC2626", secondary: "#0F172A" })
  );
  const active = getMenuItemStateStyles(tokens, { isActive: true });
  const submenu = getMenuItemStateStyles(tokens, { depth: 1, isActive: true });

  assertDifferentStateBg(String(active.container.backgroundColor), tokens.menu.background);
  assertClearSubmenuStateBg(
    String(submenu.container.backgroundColor),
    tokens.menu.background
  );
  assertReadable(String(active.container.color), String(active.container.backgroundColor));
  assertReadable(
    String(submenu.container.color),
    String(submenu.container.backgroundColor)
  );
  assert.equal(/color-mix/i.test(String(tokens.menu.subActiveBg)), false);
  assert.ok(
    getContrastRatio(tokens.menu.subActiveIndicator, tokens.menu.background) >= 3
  );
  assert.equal(submenu.container.boxShadow, "none");
});

test("keeps menu active visible when secondary is light", () => {
  const tokens = buildTenantThemeTokens(
    branding({ primary: "#2563EB", secondary: "#FFFFFF" })
  );
  const active = getMenuItemStateStyles(tokens, { isActive: true });

  assert.equal(tokens.menu.background, "#FFFFFF");
  assert.notEqual(active.container.backgroundColor, tokens.menu.background);
  assert.equal(active.indicator.backgroundColor, tokens.menu.activeIndicator);
  assertNotNearWhite(String(active.container.backgroundColor));
  assert.ok(
    getContrastRatio(
      String(active.container.color),
      String(active.container.backgroundColor)
    ) >= 4.5
  );
});

test("keeps light sidebar active and submenu states away from white", () => {
  const tokens = buildTenantThemeTokens(
    branding({ primary: "#2563EB", secondary: "#FFFFFF" })
  );
  const active = getMenuItemStateStyles(tokens, { isActive: true });
  const submenu = getMenuItemStateStyles(tokens, { depth: 1, isActive: true });

  assert.equal(tokens.menu.background, "#FFFFFF");
  assertDifferentStateBg(String(active.container.backgroundColor), tokens.menu.background);
  assertDifferentStateBg(
    String(submenu.container.backgroundColor),
    tokens.menu.background
  );
  assertNotNearWhite(String(active.container.backgroundColor));
  assertNotNearWhite(String(submenu.container.backgroundColor));
  assertReadable(String(active.container.color), String(active.container.backgroundColor));
  assertReadable(
    String(submenu.container.color),
    String(submenu.container.backgroundColor)
  );
});

test("keeps promoted child active visible on a light sidebar", () => {
  const tokens = buildTenantThemeTokens(
    branding({ primary: "#2563EB", secondary: "#FFFFFF" })
  );
  const childActive = getMenuItemStateStyles(tokens, {
    depth: 1,
    isActive: true,
    promoteActive: true,
  });

  assert.equal(tokens.menu.background, "#FFFFFF");
  assert.equal(childActive.container.backgroundColor, tokens.menu.activeBg);
  assertNotNearWhite(String(childActive.container.backgroundColor));
  assertReadable(
    String(childActive.container.color),
    String(childActive.container.backgroundColor)
  );
});

test("falls back when primary is too light for active states", () => {
  const tokens = buildTenantThemeTokens(
    branding({ primary: "#FEF3C7", secondary: "#111827" })
  );
  const active = getMenuItemStateStyles(tokens, { isActive: true });

  assert.equal(tokens.primary, "#2563EB");
  assert.equal(active.container.backgroundColor, tokens.menu.activeBg);
  assertReadable(String(active.container.color), String(active.container.backgroundColor));
  assert.ok(getContrastRatio(tokens.menu.activeIndicator, tokens.menu.background) >= 3);
});

test("falls back when primary is too dark for dark sidebar active states", () => {
  const tokens = buildTenantThemeTokens(
    branding({ primary: "#020617", secondary: "#111827" })
  );
  const active = getMenuItemStateStyles(tokens, { isActive: true });
  const submenu = getMenuItemStateStyles(tokens, { depth: 1, isActive: true });

  assert.equal(active.container.backgroundColor, tokens.menu.activeBg);
  assertDifferentStateBg(String(active.container.backgroundColor), tokens.menu.background);
  assertDifferentStateBg(
    String(submenu.container.backgroundColor),
    tokens.menu.background
  );
  assertReadable(String(active.container.color), String(active.container.backgroundColor));
  assertReadable(
    String(submenu.container.color),
    String(submenu.container.backgroundColor)
  );
});

test("keeps submenu active evident on light menu backgrounds", () => {
  const tokens = buildTenantThemeTokens(
    branding({ primary: "#1D4ED8", secondary: "#F8FAFC" })
  );
  const submenu = getMenuItemStateStyles(tokens, { depth: 1, isActive: true });

  assert.equal(tokens.menu.background, "#F8FAFC");
  assert.notEqual(submenu.container.backgroundColor, tokens.menu.background);
  assert.equal(submenu.icon.backgroundColor, tokens.menu.subActiveIndicator);
  assertNotNearWhite(String(submenu.container.backgroundColor));
  assert.equal(submenu.container.boxShadow, "none");
  assertReadable(
    String(submenu.container.color),
    String(submenu.container.backgroundColor)
  );
});

test("uses visible fallback when secondary is similar to menu background", () => {
  const tokens = buildTenantThemeTokens(
    branding({ primary: "#2563EB", secondary: "#F8FAFC" })
  );
  const submenu = getMenuItemStateStyles(tokens, { depth: 1, isActive: true });

  assert.equal(tokens.menu.background, "#F8FAFC");
  assert.notEqual(tokens.menu.subActiveIndicator, tokens.secondary);
  assert.ok(
    getContrastRatio(tokens.menu.subActiveIndicator, tokens.menu.background) >= 3
  );
  assertDifferentStateBg(
    String(submenu.container.backgroundColor),
    tokens.menu.background
  );
});

test("keeps sidebar and preview token contract aligned", () => {
  const tokens = buildTenantThemeTokens(
    branding({ primary: "#2563EB", secondary: "#0F172A" })
  );
  const submenu = getMenuItemStateStyles(tokens, { depth: 1, isActive: true });

  assert.equal(tokens.sidebar.subItemActiveBackground, tokens.menu.subActiveBg);
  assert.equal(tokens.sidebar.subItemActiveText, tokens.menu.subActiveText);
  assert.equal(tokens.sidebar.subItemActiveIndicator, tokens.menu.subActiveIndicator);
  assert.equal(tokens.sidebar.openBackground, tokens.menu.openBg);
  assert.equal(tokens.sidebar.openText, tokens.menu.openText);
  assert.equal(tokens.sidebar.openIndicator, tokens.menu.openIndicator);
  assert.equal(submenu.container.backgroundColor, tokens.menu.subActiveBg);
  assert.equal(submenu.indicator.backgroundColor, tokens.menu.subActiveIndicator);
  assert.equal(submenu.icon.backgroundColor, tokens.menu.subActiveIndicator);
});
