/*
 * ================================================================
 * tokens.generated.ts
 * Rota Design System — generated from design-tokens.tokens (1).json
 * ================================================================
 *
 * ⚠️  THIS FILE IS AUTO-GENERATED. DO NOT EDIT BY HAND.
 *
 * To regenerate:
 *   npm run tokens
 *
 * Token names are emitted exactly as generated, misspellings included.
 * ================================================================
 */

/* eslint-disable */
export const colorRoles = {
  "primary": "#012624",
  "on-primary": "#ffffff",
  "primary-container": "#cdfefb",
  "on-primary-container": "#04958d",
  "secondary": "#05c7bc",
  "on-secondary": "#ffffff",
  "secondary-container": "#cdfefb",
  "on-secondary-container": "#04958d",
  "tertiary": "#00ccc0",
  "on-tertiary": "#ffffff",
  "tertiary-container": "#ccfffc",
  "on-tertiary-container": "#009990",
  "neutral": "#1e1e1e",
  "on-neutral": "#ffffff",
  "neutral-container": "#e6e6e6",
  "on-neutral-container": "#4d4d4d",
  "neutral-variant": "#444444",
  "on-neutral-variant": "#ffffff",
  "neutral-variant-container": "#e6e6e6",
  "on-neutral-variant-container": "#4d4d4d",
  "error": "#bf0d10",
  "on-error": "#ffffff",
  "error-container": "#fccfd0",
  "on-error-container": "#8f0a0c",
  "info": "#0d2bbf",
  "on-info": "#ffffff",
  "info-container": "#cfd7fc",
  "on-info-container": "#0a208f",
  "warning": "#bf7e0d",
  "on-warning": "#ffffff",
  "warning-container": "#fcebcf",
  "on-warning-container": "#8f5e0a",
  "success": "#06c647",
  "on-success": "#ffffff",
  "success-container": "#cefdde",
  "on-success-container": "#059435",
  "surface": "#fafafa",
  "on-surface": "#1a1a1a",
  "surface-varaint": "#e6e6e6",
  "on-surface-varaint": "#4d4d4d",
  "surface-container-highest": "#e6e6e6",
  "surface-container-high": "#e6e6e6",
  "surface-container": "#f2f2f2",
  "surface-container-low": "#fafafa",
  "surface-container-lowest": "#ffffff",
  "inverse-surface": "#333333",
  "inverse-on-surface": "#f2f2f2",
  "surface-tint": "#05c7bc",
  "surface-container-lowest-2": "#808080",
  "inverse-on-surface-2": "#f2f2f2",
} as const;

export type ColorRole = keyof typeof colorRoles;

export const spacingTokens = {
  "no": 0,
  "extremely-small": 2,
  "extra-extra-samll": 4,
  "extra-small": 8,
  "medium": 12,
  "base": 16,
  "small-large": 20,
  "large": 24,
  "extra-large": 32,
  "extra-extra-large": 40,
  "very-large": 48,
  "extremely-large": 64,
} as const;

export type SpacingToken = keyof typeof spacingTokens;

export const typographyTokens = {
  "display-large": { fontFamily: "Lora", fontSize: 64, fontWeight: "600", fontStyle: "normal", lineHeight: 96, letterSpacing: -4 },
  "display-medium": { fontFamily: "Lora", fontSize: 48, fontWeight: "600", fontStyle: "normal", lineHeight: 72, letterSpacing: -3 },
  "display-small": { fontFamily: "Lora", fontSize: 32, fontWeight: "600", fontStyle: "normal", lineHeight: 48, letterSpacing: -2 },
  "headline-large": { fontFamily: "DM Sans", fontSize: 32, fontWeight: "500", fontStyle: "normal", lineHeight: 48, letterSpacing: -1.55 },
  "headline-medium": { fontFamily: "DM Sans", fontSize: 28, fontWeight: "500", fontStyle: "normal", lineHeight: 42, letterSpacing: -1.35 },
  "headline-small": { fontFamily: "DM Sans", fontSize: 24, fontWeight: "500", fontStyle: "normal", lineHeight: 36, letterSpacing: -1 },
  "title-large": { fontFamily: "DM Sans", fontSize: 22, fontWeight: "500", fontStyle: "normal", lineHeight: 33, letterSpacing: -1 },
  "title-medium": { fontFamily: "DM Sans", fontSize: 16, fontWeight: "600", fontStyle: "normal", lineHeight: 24, letterSpacing: -0.85 },
  "title-small": { fontFamily: "DM Sans", fontSize: 14, fontWeight: "500", fontStyle: "normal", lineHeight: 21, letterSpacing: -0.75 },
  "body-large": { fontFamily: "DM Sans", fontSize: 16, fontWeight: "500", fontStyle: "normal", lineHeight: 24, letterSpacing: -0.85 },
  "body-medium": { fontFamily: "DM Sans", fontSize: 14, fontWeight: "500", fontStyle: "normal", lineHeight: 21, letterSpacing: -0.75 },
  "body-small": { fontFamily: "DM Sans", fontSize: 12, fontWeight: "500", fontStyle: "normal", lineHeight: 20, letterSpacing: -0.75 },
  "label-large": { fontFamily: "DM Sans", fontSize: 14, fontWeight: "400", fontStyle: "normal", lineHeight: 21, letterSpacing: -0.9 },
  "label-medium": { fontFamily: "DM Sans", fontSize: 12, fontWeight: "400", fontStyle: "normal", lineHeight: 20, letterSpacing: -0.75 },
  "label-small": { fontFamily: "DM Sans", fontSize: 11, fontWeight: "500", fontStyle: "normal", lineHeight: 19, letterSpacing: -0.8 },
} as const;

export type TypographyToken = keyof typeof typographyTokens;

export const shadowTokens = {
  "hard": "4px 6px 8px 0px #00000052",
  "medium": "2px 4px 6px 0px #00000047",
  "soft": "2px 2px 20px 0px #0000001f",
} as const;

export type ShadowToken = keyof typeof shadowTokens;
