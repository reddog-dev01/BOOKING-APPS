
import type {
  QuoteRequestDto,
  QuoteResponse,
  CreateBookingRequestDto,
  CreateBookingResponse,
} from "./types";

type FetchOpts = {
  headers?: Record<string, string>;
  timeoutMs?: number;
};

const rawApiBase =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_BASE as string | undefined)
    : undefined;
const base = rawApiBase && rawApiBase.trim().length > 0
  ? rawApiBase.trim()
  : "http://localhost:3001/api";
const API_BASE = base.replace(/\/$/, "");

const makeUrl = (path: string) =>
  `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

// Simple fetch with timeout
async function fetchJson<T>(
  input: RequestInfo,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), init.timeoutMs ?? 15000);

  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(id);
  }
}

/** Tính giá */
export async function fetchQuote(
  dto: QuoteRequestDto,
  opts: FetchOpts = {}
): Promise<QuoteResponse> {
  return fetchJson<QuoteResponse>(makeUrl("/quote"), {
    method: "POST",
    body: JSON.stringify(dto),
    headers: opts.headers,
    timeoutMs: opts.timeoutMs ?? 10000,
  });
}

/** Tạo booking */
export async function createBooking(
  dto: CreateBookingRequestDto,
  opts: FetchOpts = {}
): Promise<CreateBookingResponse> {
  return fetchJson<CreateBookingResponse>(makeUrl("/bookings"), {
    method: "POST",
    body: JSON.stringify(dto),
    headers: opts.headers,
    timeoutMs: opts.timeoutMs ?? 12000,
  });
}
