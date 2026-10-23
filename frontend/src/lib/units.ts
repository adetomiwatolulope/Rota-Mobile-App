import { Platform, type TextStyle } from "react-native";

// The browser root font-size is 16px by default and is user-configurable, so
// text expressed in rem scales with the user's font-size setting. Native has no
// rem unit: it keeps numeric (point) values and scales through allowFontScaling.
const ROOT_FONT_SIZE = 16;

// Numbers are treated as px on web (converted to rem, so they stay adaptive).
// Strings pass through untouched as raw CSS (e.g. clamp(), em, vw). Raw CSS is
// meaningful only on web, so it is dropped on native.
function toUnit(value: number | string | undefined): number | string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") {
    return Platform.OS === "web" ? value : undefined;
  }
  return Platform.OS === "web" ? `${value / ROOT_FONT_SIZE}rem` : value;
}

type TextMetric = number | string;

type TextMetrics = {
  fontSize?: TextMetric;
  lineHeight?: TextMetric;
  letterSpacing?: TextMetric;
};

// Single boundary for the rem/number mismatch: react-native types text metrics
// as numbers, but on web they must be rem strings (or raw CSS) so text honours
// the browser's font-size setting. Spread into a style (e.g. ...textMetrics(...)).
export function textMetrics(metrics: TextMetrics): TextStyle {
  const resolved = {
    fontSize: toUnit(metrics.fontSize),
    lineHeight: toUnit(metrics.lineHeight),
    letterSpacing: toUnit(metrics.letterSpacing),
  };
  // @ts-expect-error web emits rem strings / raw CSS for text metrics; react-native types these as numbers.
  return resolved;
}
