const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CUID_REGEX = /^c[a-z0-9]{24}$/i;

export function normalizeQuoteId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (UUID_V4_REGEX.test(trimmed)) {
    // UUIDs are case-insensitive but Prisma stores lowercase.
    return trimmed.toLowerCase();
  }

  const lowered = trimmed.toLowerCase();
  if (CUID_REGEX.test(lowered)) {
    return lowered;
  }

  return null;
}
