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

const normalizeBase = (value: string | undefined, fallback?: string) => {
  const candidate = value?.trim();
  const base = candidate && candidate.length > 0 ? candidate : fallback;
  return base ? base.replace(/\/$/, "") : undefined;
};

const getServerBase = () => {
  const internalBase =
    process.env.INTERNAL_API_BASE ?? process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3006";
  return normalizeBase(internalBase, "http://localhost:3006")!;
};

const getClientBase = () => {
  const publicBase = normalizeBase(process.env.NEXT_PUBLIC_API_BASE);
  if (publicBase) return publicBase;

  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/$/, "");
  }

  return "http://localhost:3006";
};

const API_BASE = typeof window === "undefined" ? getServerBase() : getClientBase();

// Simple fetch with timeout
async function fetchJson<T>(
  input: RequestInfo,
  init: RequestInit & { timeoutMs?: number } = {},
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
  opts: FetchOpts = {},
): Promise<QuoteResponse> {
  const response = await fetchJson<QuoteResponse>(`${API_BASE}/pricing/quote`, {
    method: "POST",
    body: JSON.stringify(dto),
    headers: opts.headers,
    timeoutMs: opts.timeoutMs ?? 10000,
  });
  return {
    ...response,
    totalVnd: response.totalVnd ?? response.total,
  };
}

/** Tạo booking */
export async function createBooking(
  dto: CreateBookingRequestDto,
  opts: FetchOpts = {},
): Promise<CreateBookingResponse> {
  return fetchJson<CreateBookingResponse>(`${API_BASE}/bookings`, {
    method: "POST",
    body: JSON.stringify(dto),
    headers: opts.headers,
    timeoutMs: opts.timeoutMs ?? 12000,
  });
}
