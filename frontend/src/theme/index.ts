// Rota theme.
//
// Colour, spacing, typography and shadow values come from the generated design
// tokens (frontend/src/theme/tokens.generated.ts), which are produced from the
// Figma export by `npm run tokens`. Do not hard-code token values here.
//
// One token gap is an owner-approved extension, not part of the Figma export:
//   - radii (the token set defines no border-radius scale)
// It is kept until the owner adds it at the Figma source.
//
// The app is light-only. The token set defines no dark palette (DS-9), and the
// owner asked to keep the background white, so the OS colour scheme is ignored.
import { Platform } from "react-native";
import type { TextStyle, ViewStyle } from "react-native";
import { textMetrics } from "@/lib/units";
import {
  colorRoles,
  shadowTokens,
  spacingTokens,
  typographyTokens,
  type TypographyToken,
} from "./tokens.generated";

export type { TypographyToken };

export type ThemeColors = {
  primary: string;
  onPrimary: string;
  secondary: string;
  surface: string;
  surfaceContainer: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  error: string;
  success: string;
};

// Light palette — every value is a semantic colour role from the token set.
// The Figma source spells "variant" as "varaint"; we read it exactly as
// generated rather than aliasing it.
export const lightColors: ThemeColors = {
  primary: colorRoles.primary,
  onPrimary: colorRoles["on-primary"],
  secondary: colorRoles.secondary,
  surface: colorRoles.surface,
  onSurface: colorRoles["on-surface"],
  surfaceContainer: colorRoles["surface-container-lowest"],
  onSurfaceVariant: colorRoles["on-surface-varaint"],
  outline: colorRoles["surface-varaint"],
  error: colorRoles.error,
  success: colorRoles.success,
};

// Spacing — friendly names mapped to the generated `--space-*` tokens.
export const spacing = {
  xs: spacingTokens["extra-extra-samll"],
  sm: spacingTokens["extra-small"],
  md: spacingTokens.medium,
  base: spacingTokens.base,
  lg: spacingTokens.large,
  xl: spacingTokens["extra-large"],
  xxl: spacingTokens["very-large"],
  xxxl: spacingTokens["extremely-large"],
} as const;

// OWNER-APPROVED GAP: the design tokens define no border-radius scale.
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const fontFamily = {
  display: "Lora",
  body: "DM Sans",
} as const;

// The generated elevation tokens as CSS box-shadow strings. React Native 0.86
// supports the `boxShadow` style prop on both web and native.
export const shadows = {
  soft: { boxShadow: shadowTokens.soft },
  medium: { boxShadow: shadowTokens.medium },
  hard: { boxShadow: shadowTokens.hard },
} as const satisfies Record<string, ViewStyle>;

export const headerHeight = 72;

// React Native resolves a font by family name and, on native, does not select a
// weight from a single family the way the browser does. Each weight is loaded
// as its own family by useFonts in app/_layout.tsx, so map (family, weight) to
// the registered native family name. On web the Google Fonts link provides the
// real "Lora"/"DM Sans" families with weight selection.
const NATIVE_FAMILY: Record<string, Record<string, string>> = {
  Lora: { "600": "Lora_600SemiBold" },
  "DM Sans": {
    "400": "DMSans_400Regular",
    "500": "DMSans_500Medium",
    "600": "DMSans_600SemiBold",
  },
};

// Build a React Native text style from a whole typography token (the 15 styles
// display/headline/title/body/label × large/medium/small). Callers never set
// font-family, size, weight, line-height or letter-spacing piecemeal.
export function typeStyle(token: TypographyToken): TextStyle {
  const t = typographyTokens[token];
  const metrics = textMetrics({
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    letterSpacing: t.letterSpacing,
  });
  if (Platform.OS === "web") {
    return { ...metrics, fontFamily: t.fontFamily, fontWeight: t.fontWeight };
  }
  return {
    ...metrics,
    fontFamily: NATIVE_FAMILY[t.fontFamily]?.[t.fontWeight] ?? t.fontFamily,
  };
}

// The app is light-only: the token set defines a single palette and the owner
// asked for the white surface, so the OS colour scheme is not consulted.
export function useTheme() {
  return {
    colors: lightColors,
    spacing,
    radii,
    fontFamily,
    shadows,
    headerHeight,
  } as const;
}
