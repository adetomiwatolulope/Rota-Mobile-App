/**
 * lib/cursor.ts — Opaque keyset cursor for (createdAt, id) pagination.
 *
 * The cursor is base64url(JSON) so it is opaque to clients and safe in a query
 * string. It carries both values so equal timestamps are ordered by id and
 * never skipped. [PRD 7.1]
 */

export type Cursor = { createdAt: string; id: string };

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

/** Decode a cursor. Returns null for anything malformed. */
export function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Cursor).createdAt === "string" &&
      typeof (parsed as Cursor).id === "string"
    ) {
      const createdAt = new Date((parsed as Cursor).createdAt);
      if (Number.isNaN(createdAt.getTime())) return null;
      return { createdAt: (parsed as Cursor).createdAt, id: (parsed as Cursor).id };
    }
    return null;
  } catch {
    return null;
  }
}
