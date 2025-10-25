const FALLBACK = "http://localhost:3006";

export function getApiBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    FALLBACK;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}
