#!/usr/bin/env node

/**
 * =============================================================================
 * tokens-to-css.js
 * Rota Design System — Figma Tokens → CSS Custom Properties Converter
 * =============================================================================
 *
 * PURPOSE
 * -------
 * Reads the Figma design-token JSON file exported by the
 * "Figma Tokens" plugin (org.lukasoppermann.figmaDesignTokens) and writes a
 * single `design-tokens.css` file containing all design tokens as CSS custom
 * properties (CSS variables).
 *
 * HOW TO RUN
 * ----------
 *   node scripts/tokens-to-css.js
 *
 * This script lives at:
 *   <project-root>/scripts/tokens-to-css.js
 *
 * It expects the input file at:
 *   <project-root>/design-tokens.tokens (1).json
 *
 * It writes the output to:
 *   <project-root>/design-tokens.css
 *
 * No npm dependencies needed — runs with plain Node.js (v18+).
 *
 * =============================================================================
 * COLOUR ARCHITECTURE  ⚠️  READ THIS BEFORE USING THE OUTPUT
 * =============================================================================
 *
 * The design system uses a two-layer colour model inspired by Material Design 3:
 *
 *  Layer 1 — PRIMITIVES  (CSS prefix: --primitive-*)
 *  ┌──────────────────────────────────────────────────────────────────────┐
 *  │ Raw colour palettes: primary, secondary, tertiary, neutral,          │
 *  │ neutral-variant, error, info, warning, success, and key colours.     │
 *  │ Each palette has tonal steps from 0 (darkest) → 100 (lightest).     │
 *  │                                                                      │
 *  │ ⛔  DO NOT reference --primitive-* variables directly in             │
 *  │     component or screen styles. They exist solely as the single      │
 *  │     source of truth that the semantic colour-role layer draws from.  │
 *  └──────────────────────────────────────────────────────────────────────┘
 *
 *  Layer 2 — COLOUR ROLES  (CSS prefix: --color-*)
 *  ┌──────────────────────────────────────────────────────────────────────┐
 *  │ Semantic aliases that map UI concepts to specific primitive steps.   │
 *  │ Examples:                                                            │
 *  │   --color-primary           → background of primary action elements  │
 *  │   --color-on-primary        → text/icons placed ON primary elements  │
 *  │   --color-primary-container → tinted containers behind primary items │
 *  │   --color-surface           → default page/card background           │
 *  │   --color-error             → destructive/error indicators           │
 *  │                                                                      │
 *  │ ✅  Always use --color-* variables in component and screen styles.   │
 *  └──────────────────────────────────────────────────────────────────────┘
 *
 * OTHER TOKEN CATEGORIES
 * ----------------------
 *   --space-*        Spacing scale (0 → 64 px, 12 steps)
 *   --typography-*   Font-size, line-height, letter-spacing, font-weight,
 *                    font-family per typographic role × size variant
 *   --shadow-*       box-shadow values for the three elevation levels
 *
 * =============================================================================
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// FILE PATHS
// ---------------------------------------------------------------------------

/**
 * Resolve paths relative to the project root.
 * This script is expected to live in <root>/scripts/tokens-to-css.js.
 */
const ROOT       = path.resolve(__dirname, '..');
const INPUT_FILE = path.join(ROOT, 'design-tokens.tokens (1).json');
const OUTPUT_CSS = path.join(ROOT, 'design-tokens.css');

// ---------------------------------------------------------------------------
// UTILITY HELPERS
// ---------------------------------------------------------------------------

/**
 * Convert a Figma token name (space-separated, may contain numbers) into a
 * kebab-case string suitable for use in a CSS custom property name.
 *
 * @example
 *   toKebab('primary 30')          → 'primary-30'
 *   toKebab('on primary')          → 'on-primary'
 *   toKebab('surface container')   → 'surface-container'
 *   toKebab('extra extra samll spacing') → 'extra-extra-samll-spacing'
 *
 * @param {string} name  Raw Figma token name.
 * @returns {string}     Kebab-case string.
 */
function toKebab(name) {
  return String(name)
    .toLowerCase()
    .replace(/\s+/g, '-')        // spaces → hyphens
    .replace(/[^a-z0-9-]/g, '')  // strip all other non-alphanumeric chars
    .replace(/-+/g, '-')         // collapse consecutive hyphens
    .replace(/^-|-$/g, '');      // trim leading/trailing hyphens
}

/**
 * Normalise a Figma 8-digit hex colour to 6 digits when alpha is fully opaque.
 *
 * Figma exports all colours as 8-char hex strings (#rrggbbaa). CSS accepts this
 * format, but 6-char hex (#rrggbb) is more conventional for opaque values.
 *
 * @example
 *   normaliseHex('#012624ff') → '#012624'   (opaque → 6 chars)
 *   normaliseHex('#0000001f') → '#0000001f' (transparent → unchanged)
 *   normaliseHex('#abc')      → '#abc'      (short form → unchanged)
 *
 * @param {string} hex  Raw colour string from the token file.
 * @returns {string}    Normalised colour string.
 */
function normaliseHex(hex) {
  if (typeof hex !== 'string') return String(hex);
  // 9 chars: '#' + 8 hex digits. Last two digits are alpha.
  if (hex.length === 9 && hex.toLowerCase().endsWith('ff')) {
    return hex.slice(0, 7); // drop the opaque alpha suffix
  }
  return hex;
}

// ---------------------------------------------------------------------------
// PRIMITIVE LOOKUP TABLE
// ---------------------------------------------------------------------------

/**
 * Build a flat Map of every primitive colour token keyed by its Figma
 * dot-notation path (e.g. "primitives.primary colors.primary 30").
 *
 * This is used to resolve the Figma alias syntax used in colour-role tokens:
 *   `{primitives.primary colors.primary 30}` → "#04958d"
 *
 * Only the "primitives" top-level section is walked — colour roles themselves
 * are never used as alias targets.
 *
 * @param {object} tokens  The fully-parsed JSON token object.
 * @returns {Map<string, string>}  Dot-path → raw hex value.
 */
function buildPrimitiveLookup(tokens) {
  /** @type {Map<string, string>} */
  const lookup = new Map();

  /**
   * Recursive depth-first walker.
   *
   * @param {object} node        Current node in the token tree.
   * @param {string[]} pathParts Accumulated path segments.
   */
  function walk(node, pathParts) {
    if (node === null || typeof node !== 'object') return;

    // A "leaf" token has both `type` and `value` properties.
    if ('type' in node && 'value' in node) {
      lookup.set(pathParts.join('.'), node.value);
      return;
    }

    for (const [key, child] of Object.entries(node)) {
      // Skip the Figma-plugin metadata block — it contains no colour values.
      if (key === 'extensions') continue;
      walk(child, [...pathParts, key]);
    }
  }

  if (tokens.primitives) {
    walk(tokens.primitives, ['primitives']);
  }

  return lookup;
}

/**
 * Resolve a Figma alias reference to its concrete value.
 *
 * Figma alias syntax: `{primitives.primary colors.primary 30}`
 * If the value is not an alias (i.e. already a hex string), it is returned
 * unchanged.
 *
 * @param {string}              value   Raw token value.
 * @param {Map<string,string>}  lookup  Primitive lookup table.
 * @returns {string}  Resolved colour value, or the original string if it
 *                    is not an alias or cannot be resolved.
 */
function resolveAlias(value, lookup) {
  if (typeof value !== 'string') return String(value);

  const match = value.match(/^\{(.+)\}$/);
  if (!match) return value; // Not an alias.

  const aliasPath = match[1];
  const resolved  = lookup.get(aliasPath);

  if (resolved === undefined) {
    // Warn but do not throw — the CSS will still be written with the raw alias
    // so the developer knows something needs fixing.
    console.warn(`  ⚠  Unresolved alias: {${aliasPath}}`);
    return value;
  }

  return resolved;
}

/**
 * Given a Figma alias path, return the CSS variable name that will be emitted
 * for the corresponding primitive token.
 *
 * Used to annotate colour-role variables with a trace comment so developers
 * can follow the chain: --color-primary → --primitive-primary-key-color → #012624
 *
 * @example
 *   aliasToPrimitiveVarName('primitives.key colors.primary key color')
 *   → '--primitive-key-primary-key-color'
 *
 * @param {string} aliasPath  Dot-notation path inside the alias curly braces.
 * @returns {string}          CSS custom property name for the primitive.
 */
function aliasToPrimitiveVarName(aliasPath) {
  // Remove the leading "primitives." prefix, then convert remaining dots
  // and spaces to a single kebab-case identifier.
  const withoutPrefix = aliasPath.replace(/^primitives\./, '');
  const kebab = toKebab(withoutPrefix.replace(/\./g, ' '));
  return `--primitive-${kebab}`;
}

// ---------------------------------------------------------------------------
// SECTION: SHADOWS
// ---------------------------------------------------------------------------

/**
 * Generate the `:root { }` block for SHADOW (elevation) tokens.
 *
 * Figma exports shadows as `custom-shadow` type objects. We convert them to
 * standard CSS `box-shadow` values.
 *
 * @param {object} effect  `tokens.effect` — the top-level effects object.
 * @returns {string}       CSS text for this section.
 */
function generateShadows(effect) {
  const lines = [];

  lines.push('/* ============================================================');
  lines.push(' * ELEVATION / SHADOWS');
  lines.push(' * ============================================================');
  lines.push(' *');
  lines.push(' * Three elevation levels expressed as CSS box-shadow values.');
  lines.push(' *');
  lines.push(' *   --shadow-soft    Subtle lift. Use for cards at rest.');
  lines.push(' *   --shadow-medium  Moderate elevation. Use for dropdowns / drawers.');
  lines.push(' *   --shadow-hard    Strong elevation. Use for dialogs / modals.');
  lines.push(' *');
  lines.push(' * Usage:');
  lines.push(' *   box-shadow: var(--shadow-soft);');
  lines.push(' * ============================================================ */');
  lines.push(':root {');

  for (const [shadowName, token] of Object.entries(effect)) {
    if (!token || token.type !== 'custom-shadow' || !token.value) continue;

    const { shadowType, offsetX, offsetY, radius, spread, color } = token.value;
    const cssColor  = normaliseHex(color);

    // Figma "innerShadow" → CSS inset keyword; "dropShadow" → no keyword.
    const inset     = shadowType === 'innerShadow' ? 'inset ' : '';
    const cssValue  = `${inset}${offsetX}px ${offsetY}px ${radius}px ${spread}px ${cssColor}`;

    // Derive clean variable name: "hard shadow" → "--shadow-hard"
    const slug    = toKebab(shadowName.replace(/\s+shadow$/i, ''));
    const varName = `--shadow-${slug}`;

    lines.push(`  ${varName}: ${cssValue};`);
  }

  lines.push('}');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// SECTION: PRIMITIVE COLOURS
// ---------------------------------------------------------------------------

/**
 * Generate the `:root { }` block for PRIMITIVE COLOUR tokens.
 *
 * These are the raw tonal palettes — the foundation of the colour system.
 * They are prefixed `--primitive-` and carry prominent warnings instructing
 * developers NOT to use them directly in component styles.
 *
 * @param {object} primitives  `tokens.primitives` — the full primitives object.
 * @returns {string}           CSS text for this section.
 */
function generatePrimitiveColors(primitives) {
  const lines = [];

  lines.push('/* ============================================================');
  lines.push(' * PRIMITIVE COLOURS  —  FOUNDATION LAYER');
  lines.push(' * ============================================================');
  lines.push(' *');
  lines.push(' * ⛔  DO NOT use --primitive-* variables directly in');
  lines.push(' *     component or screen styles.');
  lines.push(' *');
  lines.push(' * These are the raw tonal palettes from which all semantic');
  lines.push(' * colour roles (--color-*) are derived. They exist as the');
  lines.push(' * single authoritative source of truth for the colour system.');
  lines.push(' *');
  lines.push(' * Palette families:');
  lines.push(' *   Key Colours        — Named source hues for each palette family.');
  lines.push(' *   Primary            — Brand teal scale.');
  lines.push(' *   Secondary          — Mirrors primary for layered use.');
  lines.push(' *   Tertiary           — Complementary teal variant.');
  lines.push(' *   Neutral            — Pure grey scale for surfaces & text.');
  lines.push(' *   Neutral Variant    — Slightly warmer grey scale.');
  lines.push(' *   Error              — Red scale for destructive states.');
  lines.push(' *   Info               — Blue scale for informational states.');
  lines.push(' *   Warning            — Amber scale for cautionary states.');
  lines.push(' *   Success            — Green scale for positive states.');
  lines.push(' *');
  lines.push(' * Tonal step convention:');
  lines.push(' *   0   = Absolute black end of the scale.');
  lines.push(' *   100 = Absolute white end of the scale.');
  lines.push(' *   Intermediate steps are non-linear; smaller steps appear');
  lines.push(' *   where finer tonal distinctions are needed (95, 98, 99).');
  lines.push(' * ============================================================ */');
  lines.push(':root {');

  // Emit palettes in a logical order that mirrors the token file structure.
  const paletteOrder = [
    'key colors',
    'primary colors',
    'secondary colors',
    'tertiary colors',
    'neutral colors',
    'neutral variant colors',
    'error colors',
    'info colors',
    'warning colors',
    'success colors',
  ];

  for (const paletteName of paletteOrder) {
    const palette = primitives[paletteName];
    if (!palette) continue;

    lines.push('');
    lines.push(`  /* --- ${paletteName.toUpperCase()} --- */`);

    for (const [tokenName, token] of Object.entries(palette)) {
      if (!token || typeof token !== 'object' || !('value' in token)) continue;

      // Variable name pattern: --primitive-<palette-slug>-<token-slug>
      // e.g. --primitive-primary-primary-30  (we strip the redundant "colors" suffix)
      const paletteSlug = toKebab(paletteName.replace(/ colors$/, ''));
      const tokenSlug   = toKebab(tokenName);
      const varName     = `--primitive-${paletteSlug}-${tokenSlug}`;
      const value       = normaliseHex(token.value);

      lines.push(`  ${varName}: ${value};`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// SECTION: COLOUR ROLES
// ---------------------------------------------------------------------------

/**
 * Generate the `:root { }` block for COLOUR ROLE tokens.
 *
 * Colour roles are semantic aliases — each one maps a UI concept to a concrete
 * primitive step. These are the ONLY colour variables that component and screen
 * styles should reference.
 *
 * Each emitted variable carries an inline trace comment that shows:
 *   - the primitive CSS variable it resolves to
 *   - the concrete hex value
 *
 * @param {object}              colorRoles  `tokens['color roles']`
 * @param {Map<string,string>}  lookup      Primitive lookup table.
 * @returns {string}                        CSS text for this section.
 */
function generateColorRoles(colorRoles, lookup) {
  const lines = [];

  lines.push('/* ============================================================');
  lines.push(' * COLOUR ROLES  —  SEMANTIC LAYER');
  lines.push(' * ============================================================');
  lines.push(' *');
  lines.push(' * ✅  Use these --color-* variables in all component and');
  lines.push(' *     screen styles. Never reference --primitive-* directly.');
  lines.push(' *');
  lines.push(' * Each variable carries a trace comment showing which');
  lines.push(' * primitive it aliases and the resolved hex value.');
  lines.push(' *');
  lines.push(' * Naming patterns (Material Design 3 convention):');
  lines.push(' *');
  lines.push(' *   --color-<role>');
  lines.push(' *       The main colour for that role.');
  lines.push(' *       e.g. background of a primary button.');
  lines.push(' *');
  lines.push(' *   --color-on-<role>');
  lines.push(' *       Colour for content (text, icons) placed ON the role colour.');
  lines.push(' *       Always meets contrast requirements against --color-<role>.');
  lines.push(' *');
  lines.push(' *   --color-<role>-container');
  lines.push(' *       Lighter tinted background for elements associated with the role.');
  lines.push(' *');
  lines.push(' *   --color-on-<role>-container');
  lines.push(' *       Content colour for use ON the container colour.');
  lines.push(' *');
  lines.push(' * Surface roles (layered elevation system):');
  lines.push(' *   --color-surface                  Default background (lightest).');
  lines.push(' *   --color-surface-container-lowest Lower surface layer.');
  lines.push(' *   --color-surface-container-low    ↑');
  lines.push(' *   --color-surface-container        Mid surface layer.');
  lines.push(' *   --color-surface-container-high   ↓');
  lines.push(' *   --color-surface-container-highest Raised surface (e.g. cards).');
  lines.push(' *   --color-inverse-surface           Dark surface for inverse theming.');
  lines.push(' * ============================================================ */');
  lines.push(':root {');

  /**
   * Role names grouped in a logical order that matches how they are described
   * in the Material Design 3 colour system documentation. Grouping improves
   * readability of the generated CSS and makes the pattern immediately obvious.
   *
   * NOTE: The Figma file contains a typo ("varaint" instead of "variant").
   *       We preserve it here so the keys match exactly, and map it to the
   *       correct corrected CSS variable name via toKebab() normalisation.
   */
  const groups = {
    'Primary': [
      'primary',
      'on primary',
      'primary container',
      'on primary container',
    ],
    'Secondary': [
      'secondary',
      'on secondary',
      'secondary container',
      'on secondary container',
    ],
    'Tertiary': [
      'tertiary',
      'on tertiary',
      'tertiary container',
      'on tertiary container',
    ],
    'Neutral': [
      'neutral',
      'on neutral',
      'neutral container',
      'on neutral container',
    ],
    'Neutral Variant': [
      'neutral variant',
      'on neutral variant',
      'neutral variant container',
      'on neutral variant container',
    ],
    'Error': [
      'error',
      'on error',
      'error container',
      'on error container',
    ],
    'Info': [
      'info',
      'on info',
      'info container',
      'on info container',
    ],
    'Warning': [
      'warning',
      'on warning',
      'warning container',
      'on warning container',
    ],
    'Success': [
      'success',
      'on success',
      'success container',
      'on success container',
    ],
    'Surface': [
      'surface',
      'on surface',
      'surface varaint',          // Figma typo intentionally preserved for key lookup
      'on surface varaint',       // same
      'surface container lowest',
      'surface container low',
      'surface container',
      'surface container high',
      'surface container highest',
      'surface container lowest 2',
      'inverse surface',
      'inverse on surface',
      'inverse on surface 2',
      'surface tint',
    ],
  };

  /** Track emitted role keys to avoid duplicates in the fallback loop. */
  const emitted = new Set();

  for (const [groupLabel, roleNames] of Object.entries(groups)) {
    const groupLines = [];

    for (const roleName of roleNames) {
      const token = colorRoles[roleName];
      if (!token || typeof token !== 'object' || !('value' in token)) continue;

      const rawValue = token.value;
      const resolved = resolveAlias(rawValue, lookup);
      const cssValue = normaliseHex(resolved);

      // Use toKebab on the role name. This also fixes the Figma typo:
      // "surface varaint" → "surface-varaint" … we intentionally do NOT
      // auto-correct the typo in the var name so future Figma exports remain
      // compatible without a code change. Designers should fix it in Figma.
      const varName = `--color-${toKebab(roleName)}`;

      // Build inline trace comment for any alias reference.
      let traceComment = '';
      if (typeof rawValue === 'string' && rawValue.startsWith('{')) {
        const aliasPath    = rawValue.slice(1, -1);      // strip { }
        const primitiveVar = aliasToPrimitiveVarName(aliasPath);
        traceComment = ` /* → ${primitiveVar} (${cssValue}) */`;
      }

      groupLines.push(`  ${varName}: ${cssValue};${traceComment}`);
      emitted.add(roleName);
    }

    if (groupLines.length > 0) {
      lines.push('');
      lines.push(`  /* --- ${groupLabel.toUpperCase()} ROLES --- */`);
      lines.push(...groupLines);
    }
  }

  // Emit any colour-role tokens not covered by the explicit groups above.
  // This acts as a future-proof catch-all for roles added to the Figma file.
  const ungrouped = Object.entries(colorRoles).filter(([k]) => !emitted.has(k));
  if (ungrouped.length > 0) {
    lines.push('');
    lines.push('  /* --- OTHER / UNGROUPED ROLES --- */');
    for (const [roleName, token] of ungrouped) {
      if (!token || typeof token !== 'object' || !('value' in token)) continue;
      const resolved = resolveAlias(token.value, lookup);
      const cssValue = normaliseHex(resolved);
      lines.push(`  --color-${toKebab(roleName)}: ${cssValue};`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// SECTION: SPACING
// ---------------------------------------------------------------------------

/**
 * Generate the `:root { }` block for SPACING tokens.
 *
 * Dimension values in the Figma export are plain numbers (no units). We append
 * `px` to produce valid CSS length values. The exception is `0`, which is
 * written without a unit (valid in CSS and avoids a pointless "0px").
 *
 * @param {object} spacingSystem  `tokens['spacing system']`
 * @returns {string}              CSS text for this section.
 */
function generateSpacing(spacingSystem) {
  const lines = [];

  lines.push('/* ============================================================');
  lines.push(' * SPACING SYSTEM');
  lines.push(' * ============================================================');
  lines.push(' *');
  lines.push(' * All spacing values are in pixels, built on a base-4 grid.');
  lines.push(' * Use these tokens for padding, margin, gap, and inset values.');
  lines.push(' *');
  lines.push(' * Quick reference:');
  lines.push(' *   --space-no-spacing                0    px');
  lines.push(' *   --space-extremely-small-spacing    2    px');
  lines.push(' *   --space-extra-extra-samll-spacing  4    px  (typo in Figma source)');
  lines.push(' *   --space-extra-small-spacing        8    px');
  lines.push(' *   --space-medium-spacing             12   px');
  lines.push(' *   --space-base-spacing               16   px  ← base unit');
  lines.push(' *   --space-small-large-spacing        20   px');
  lines.push(' *   --space-large-spacing              24   px');
  lines.push(' *   --space-extra-large-spacing        32   px');
  lines.push(' *   --space-extra-extra-large-spacing  40   px');
  lines.push(' *   --space-very-large-spacing         48   px');
  lines.push(' *   --space-extremely-large-spacing    64   px');
  lines.push(' * ============================================================ */');
  lines.push(':root {');

  for (const [tokenName, token] of Object.entries(spacingSystem)) {
    if (!token || typeof token !== 'object' || !('value' in token)) continue;

    const varName  = `--space-${toKebab(tokenName)}`;
    const rawValue = token.value;
    // CSS spec: unitless 0 is valid; all other lengths need a unit.
    const cssValue = rawValue === 0 ? '0' : `${rawValue}px`;

    lines.push(`  ${varName}: ${cssValue};`);
  }

  lines.push('}');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// SECTION: TYPOGRAPHY
// ---------------------------------------------------------------------------

/**
 * Generate the `:root { }` block for TYPOGRAPHY tokens.
 *
 * The token file contains a nested structure:
 *   typography → <scale> → <variant> → <property>: { type, value }
 *
 * For each scale × variant (e.g. "display large", "body medium") we emit
 * individual CSS custom properties:
 *   --typography-<scale>-<variant>-font-family
 *   --typography-<scale>-<variant>-font-size
 *   --typography-<scale>-<variant>-font-weight
 *   --typography-<scale>-<variant>-line-height
 *   --typography-<scale>-<variant>-letter-spacing
 *   --typography-<scale>-<variant>-font-style
 *
 * A commented shorthand hint is also emitted so developers can quickly
 * compose a `font:` declaration if needed.
 *
 * @param {object} typography  `tokens.typography`
 * @returns {string}           CSS text for this section.
 */
function generateTypography(typography) {
  const lines = [];

  lines.push('/* ============================================================');
  lines.push(' * TYPOGRAPHY');
  lines.push(' * ============================================================');
  lines.push(' *');
  lines.push(' * Two font families are used across the type scale:');
  lines.push(' *   Lora    — Display styles (expressive, serif).');
  lines.push(' *             Must be loaded from Google Fonts or self-hosted.');
  lines.push(' *   DM Sans — All other styles (clean, geometric sans-serif).');
  lines.push(' *             Must be loaded from Google Fonts or self-hosted.');
  lines.push(' *');
  lines.push(' * Type scale hierarchy (largest → smallest):');
  lines.push(' *   display   → Expressive marketing / hero text (Lora).');
  lines.push(' *   headline  → Major section headings (DM Sans).');
  lines.push(' *   title     → Card and list headings (DM Sans).');
  lines.push(' *   body      → Regular readable copy (DM Sans).');
  lines.push(' *   label     → Captions, chips, helper text (DM Sans).');
  lines.push(' *');
  lines.push(' * Each scale has three size variants: large / medium / small.');
  lines.push(' *');
  lines.push(' * Usage example:');
  lines.push(' *   font-family:    var(--typography-body-large-font-family);');
  lines.push(' *   font-size:      var(--typography-body-large-font-size);');
  lines.push(' *   font-weight:    var(--typography-body-large-font-weight);');
  lines.push(' *   line-height:    var(--typography-body-large-line-height);');
  lines.push(' *   letter-spacing: var(--typography-body-large-letter-spacing);');
  lines.push(' * ============================================================ */');
  lines.push(':root {');

  /**
   * List of token property keys to extract from each typography variant node.
   * Order matches the shorthand `font:` property convention.
   */
  const LEAF_PROPS = [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'lineHeight',
    'letterSpacing',
  ];

  for (const [scaleName, variants] of Object.entries(typography)) {
    lines.push('');
    lines.push(`  /* --- ${scaleName.toUpperCase()} SCALE --- */`);

    for (const [variantName, props] of Object.entries(variants)) {
      const prefix = `--typography-${toKebab(scaleName)}-${toKebab(variantName)}`;

      lines.push(`  /* ${scaleName} / ${variantName} */`);

      for (const prop of LEAF_PROPS) {
        const tokenProp = props[prop];
        if (!tokenProp || typeof tokenProp !== 'object' || !('value' in tokenProp)) continue;

        // Convert camelCase prop name → kebab-case CSS property segment
        const cssPropSlug = toKebab(prop); // e.g. "fontFamily" → "font-family"
        const varName     = `${prefix}-${cssPropSlug}`;
        let   cssValue    = tokenProp.value;

        // Dimension-type values need a px unit; string/number types do not.
        if (tokenProp.type === 'dimension') {
          cssValue = cssValue === 0 ? '0' : `${cssValue}px`;
        }

        lines.push(`  ${varName}: ${cssValue};`);
      }

      // Shorthand hint — makes it easy for a developer to compose font:.
      const sizeVal   = props.fontSize?.value;
      const heightVal = props.lineHeight?.value;
      const weightVal = props.fontWeight?.value;
      const familyVal = props.fontFamily?.value;
      if (sizeVal && heightVal && familyVal) {
        lines.push(
          `  /* Hint → font: ${weightVal ?? 400} ${sizeVal}px/${heightVal}px '${familyVal}', sans-serif; */`
        );
      }
    }
  }

  lines.push('}');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

/**
 * Script entry point.
 *
 * Reads the input JSON, orchestrates each section generator, assembles the
 * final CSS text, and writes it to disk.
 */
function main() {
  // ------------------------------------------------------------------
  // 1. Read and parse the token file.
  // ------------------------------------------------------------------
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`\n❌  Input file not found:\n   ${INPUT_FILE}\n`);
    process.exit(1);
  }

  console.log(`\n📖  Reading:  ${INPUT_FILE}\n`);
  const raw    = fs.readFileSync(INPUT_FILE, 'utf8');
  /** @type {object} */
  const tokens = JSON.parse(raw);

  // ------------------------------------------------------------------
  // 2. Build the primitive lookup table for alias resolution.
  // ------------------------------------------------------------------
  const lookup = buildPrimitiveLookup(tokens);
  console.log(`🔍  Primitive lookup built — ${lookup.size} entries.`);

  // ------------------------------------------------------------------
  // 3. Generate each CSS section.
  // ------------------------------------------------------------------

  /** File-level header comment. */
  const header = [
    '/*',
    ' * ================================================================',
    ' * design-tokens.css',
    ' * Rota Design System — Generated CSS Custom Properties',
    ' * ================================================================',
    ' *',
    ' * ⚠️  THIS FILE IS AUTO-GENERATED. DO NOT EDIT BY HAND.',
    ' *',
    ' * To regenerate:',
    ' *   node scripts/tokens-to-css.js',
    ' *',
    ' * Source:    design-tokens.tokens (1).json',
    ' * Generator: scripts/tokens-to-css.js',
    ` * Generated: ${new Date().toISOString()}`,
    ' *',
    ' * ────────────────────────────────────────────────',
    ' * COLOUR LAYER RULE',
    ' * ────────────────────────────────────────────────',
    ' *  ⛔  --primitive-*  Raw palette — DO NOT use in components.',
    ' *  ✅  --color-*      Semantic roles — USE THESE in components.',
    ' *',
    ' * See scripts/tokens-to-css.js for full architecture docs.',
    ' * ================================================================',
    ' */',
  ].join('\n');

  const sections = [header];

  if (tokens.effect) {
    console.log('✏️   Shadows...');
    sections.push(generateShadows(tokens.effect));
  }

  if (tokens.primitives) {
    console.log('✏️   Primitive colours...');
    sections.push(generatePrimitiveColors(tokens.primitives));
  }

  if (tokens['color roles']) {
    console.log('✏️   Colour roles...');
    sections.push(generateColorRoles(tokens['color roles'], lookup));
  }

  if (tokens['spacing system']) {
    console.log('✏️   Spacing...');
    sections.push(generateSpacing(tokens['spacing system']));
  }

  if (tokens.typography) {
    console.log('✏️   Typography...');
    sections.push(generateTypography(tokens.typography));
  }

  // ------------------------------------------------------------------
  // 4. Write output.
  // ------------------------------------------------------------------
  const output = sections.join('\n\n') + '\n';
  fs.writeFileSync(OUTPUT_CSS, output, 'utf8');

  // Summary stats.
  const varCount  = (output.match(/^\s+--[a-z]/gm) || []).length;
  const lineCount = output.split('\n').length;

  console.log(`\n✅  Written:  ${OUTPUT_CSS}`);
  console.log(`\n📊  Stats:`);
  console.log(`   Lines         : ${lineCount}`);
  console.log(`   CSS variables : ${varCount}`);
}

main();
