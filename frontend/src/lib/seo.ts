export const SITE_NAME = "Rota";
export const DEFAULT_TITLE = "Rota — Shift scheduling for small businesses";
export const DEFAULT_DESCRIPTION =
  "Rota helps small shift-based businesses publish schedules, approve shift swaps, and keep every team member in sync.";

// Set EXPO_PUBLIC_SITE_URL to the production origin (e.g. https://rota.example) to
// emit absolute canonical, Open Graph, and Twitter URLs. Left empty until provided.
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

export function formatTitle(page?: string): string {
  return page ? `${page} · ${SITE_NAME}` : DEFAULT_TITLE;
}

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return SITE_URL ? `${SITE_URL}${normalized}` : normalized;
}
