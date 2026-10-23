#!/usr/bin/env node

/**
 * =============================================================================
 * tokens-to-ts.js
 * Rota Design System — Figma Tokens → TypeScript module
 * =============================================================================
 *
 * PURPOSE
 * -------
 * Reads the same Figma token JSON that feeds `design-tokens.css` and writes a
 * typed TypeScript module the React Native app can consume at runtime. React
 * Native cannot read CSS custom properties, so the native side needs the token
 * *values*; emitting them from the shared JSON keeps one source of truth
 * (design-tokens.tokens (1).json) for both the web stylesheet and the app.
 *
 * HOW TO RUN
 * ----------
 *   node scripts/tokens-to-ts.js
 *
 * INPUT  : <project-root>/design-tokens.tokens (1).json
 * OUTPUT : <project-root>/frontend/src/theme/tokens.generated.ts
 *
 * Token names are emitted exactly as generated (misspellings such as
 * "samll" and "varaint" included) so they stay aligned with design-tokens.css.
 *
 * =============================================================================
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT        = path.resolve(__dirname, '..');
const INPUT_FILE  = path.join(ROOT, 'design-tokens.tokens (1).json');
const OUTPUT_FILE = path.join(ROOT, 'frontend', 'src', 'theme', 'tokens.generated.ts');

// ---------------------------------------------------------------------------
// HELPERS (mirrors scripts/tokens-to-css.js so both outputs name things alike)
// ---------------------------------------------------------------------------

function toKebab(name) {
  return String(name)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normaliseHex(hex) {
  if (typeof hex !== 'string') return String(hex);
  if (hex.length === 9 && hex.toLowerCase().endsWith('ff')) {
    return hex.slice(0, 7);
  }
  return hex;
}

function buildPrimitiveLookup(tokens) {
  const lookup = new Map();
  function walk(node, pathParts) {
    if (node === null || typeof node !== 'object') return;
    if ('type' in node && 'value' in node) {
      lookup.set(pathParts.join('.'), node.value);
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (key === 'extensions') continue;
      walk(child, [...pathParts, key]);
    }
  }
  if (tokens.primitives) walk(tokens.primitives, ['primitives']);
  return lookup;
}

function resolveAlias(value, lookup) {
  if (typeof value !== 'string') return String(value);
  const match = value.match(/^\{(.+)\}$/);
  if (!match) return value;
  const resolved = lookup.get(match[1]);
  if (resolved === undefined) {
    console.warn(`  ⚠  Unresolved alias: {${match[1]}}`);
    return value;
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// SECTIONS
// ---------------------------------------------------------------------------

function emitColors(tokens, lookup) {
  const lines = [];
  for (const [roleName, token] of Object.entries(tokens['color roles'])) {
    if (!token || typeof token !== 'object' || !('value' in token)) continue;
    const key   = toKebab(roleName);
    const value = normaliseHex(resolveAlias(token.value, lookup));
    lines.push(`  "${key}": "${value}",`);
  }
  return lines.join('\n');
}

function emitSpacing(tokens) {
  const lines = [];
  for (const [name, token] of Object.entries(tokens['spacing system'])) {
    if (!token || typeof token !== 'object' || !('value' in token)) continue;
    const key = toKebab(name).replace(/-spacing$/, '');
    lines.push(`  "${key}": ${token.value},`);
  }
  return lines.join('\n');
}

function emitTypography(tokens) {
  const LEAF = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing'];
  const blocks = [];
  for (const [scale, variants] of Object.entries(tokens.typography)) {
    for (const [variant, props] of Object.entries(variants)) {
      const key = `${toKebab(scale)}-${toKebab(variant)}`;
      const fields = [];
      for (const prop of LEAF) {
        const leaf = props[prop];
        if (!leaf || typeof leaf !== 'object' || !('value' in leaf)) continue;
        // React Native types fontWeight as a string union, so always quote it.
        const isQuoted = typeof leaf.value === 'string' || prop === 'fontWeight';
        const value = isQuoted ? `"${leaf.value}"` : leaf.value;
        fields.push(`${prop}: ${value}`);
      }
      blocks.push(`  "${key}": { ${fields.join(', ')} },`);
    }
  }
  return blocks.join('\n');
}

function emitShadows(tokens) {
  const lines = [];
  for (const [name, token] of Object.entries(tokens.effect)) {
    if (!token || token.type !== 'custom-shadow' || !token.value) continue;
    const { shadowType, offsetX, offsetY, radius, spread, color } = token.value;
    const inset = shadowType === 'innerShadow' ? 'inset ' : '';
    const css   = `${inset}${offsetX}px ${offsetY}px ${radius}px ${spread}px ${normaliseHex(color)}`;
    const key   = toKebab(name.replace(/\s+shadow$/i, ''));
    lines.push(`  "${key}": "${css}",`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`\n❌  Input file not found:\n   ${INPUT_FILE}\n`);
    process.exit(1);
  }

  console.log(`\n📖  Reading:  ${INPUT_FILE}\n`);
  const tokens = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  const lookup = buildPrimitiveLookup(tokens);

  const header = [
    '/*',
    ' * ================================================================',
    ' * tokens.generated.ts',
    ' * Rota Design System — generated from design-tokens.tokens (1).json',
    ' * ================================================================',
    ' *',
    ' * ⚠️  THIS FILE IS AUTO-GENERATED. DO NOT EDIT BY HAND.',
    ' *',
    ' * To regenerate:',
    ' *   npm run tokens',
    ' *',
    ' * Token names are emitted exactly as generated, misspellings included.',
    ' * ================================================================',
    ' */',
    '',
    '/* eslint-disable */',
    '',
  ].join('\n');

  const body = [
    'export const colorRoles = {',
    emitColors(tokens, lookup),
    '} as const;',
    '',
    'export type ColorRole = keyof typeof colorRoles;',
    '',
    'export const spacingTokens = {',
    emitSpacing(tokens),
    '} as const;',
    '',
    'export type SpacingToken = keyof typeof spacingTokens;',
    '',
    'export const typographyTokens = {',
    emitTypography(tokens),
    '} as const;',
    '',
    'export type TypographyToken = keyof typeof typographyTokens;',
    '',
    'export const shadowTokens = {',
    emitShadows(tokens),
    '} as const;',
    '',
    'export type ShadowToken = keyof typeof shadowTokens;',
    '',
  ].join('\n');

  fs.writeFileSync(OUTPUT_FILE, `${header}${body}`, 'utf8');
  console.log(`\n✅  Written:  ${OUTPUT_FILE}`);
}

main();
