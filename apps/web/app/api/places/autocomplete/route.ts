import { NextRequest, NextResponse } from "next/server";

import {
  MissingApiKeyError,
  PlacesApiError,
  fetchAutocomplete,
} from "../../../../lib/server/googlePlacesRest";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const WINDOW_MS = 15_000;
const MAX_REQUESTS = 30;
const rateBuckets = new Map<string, { count: number; ts: number }>();

type AutocompletePayload = {
  input: string;
  sessionToken?: string;
  country?: string;
  languageCode?: string;
};

type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

type GoogleErrorPayload = {
  error?: { code?: number | string; status?: string | null };
};

const STATUS_TEXT_TO_CODE: Record<string, number> = {
  PERMISSION_DENIED: 403,
  INVALID_ARGUMENT: 400,
  NOT_FOUND: 404,
  RESOURCE_EXHAUSTED: 429,
  UNAVAILABLE: 503,
  INTERNAL: 500,
};

const isErrorStatus = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 400 && value < 600;

const coerceStatus = (value: unknown): number | null => {
  if (isErrorStatus(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed >= 400 && parsed < 600) {
      return parsed;
    }
  }

  return null;
};

const resolveStatusFromText = (value: unknown): number | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return STATUS_TEXT_TO_CODE[normalized] ?? null;
};

const extractStatusFromDetails = (details: unknown): number | null => {
  const payload = details as GoogleErrorPayload | null;
  const fromCode = coerceStatus(payload?.error?.code);
  if (fromCode) {
    return fromCode;
  }

  return resolveStatusFromText(payload?.error?.status);
};

const resolveErrorStatus = (error: PlacesApiError): number => {
  const payloadStatus = extractStatusFromDetails(error.details);
  if (payloadStatus) {
    return payloadStatus;
  }

  const upstreamStatus = coerceStatus(error.status);
  if (upstreamStatus) {
    return upstreamStatus;
  }

  return 502;
};

function takeSlot(key: string): boolean {
  const now = Date.now();
  const current = rateBuckets.get(key);

  if (!current || now - current.ts > WINDOW_MS) {
    rateBuckets.set(key, { count: 1, ts: now });
    return true;
  }

  if (current.count >= MAX_REQUESTS) {
    return false;
  }

  current.count += 1;
  return true;
}

function parseAutocompletePayload(payload: unknown): ValidationResult<AutocompletePayload> {
  if (!payload || typeof payload !== "object") {
    return { success: false, error: "Payload không hợp lệ." };
  }

  const { input, sessionToken, country, languageCode } =
    payload as Record<string, unknown>;

  if (typeof input !== "string" || input.trim().length === 0) {
    return { success: false, error: "Thiếu từ khóa để gợi ý." };
  }

  if (sessionToken !== undefined && typeof sessionToken !== "string") {
    return { success: false, error: "sessionToken phải là chuỗi." };
  }

  if (country !== undefined) {
    if (typeof country !== "string" || !/^[A-Za-z]{2}$/.test(country)) {
      return { success: false, error: "Country code phải gồm 2 ký tự." };
    }
  }

  if (languageCode !== undefined) {
    if (typeof languageCode !== "string" || languageCode.length < 2 || languageCode.length > 10) {
      return { success: false, error: "languageCode phải từ 2-10 ký tự." };
    }
  }

  return {
    success: true,
    data: {
      input,
      sessionToken: typeof sessionToken === "string" ? sessionToken : undefined,
      country: typeof country === "string" ? country : undefined,
      languageCode: typeof languageCode === "string" ? languageCode : undefined,
    },
  };
}

function extractReferer(request: NextRequest): string | undefined {
  const origin = request.headers.get("origin");
  if (origin) return origin;

  const referer = request.headers.get("referer");
  if (!referer) return undefined;

  try {
    const url = new URL(referer);
    return url.origin;
  } catch {
    return undefined;
  }
}

function resolveClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  if (request.ip) {
    return request.ip;
  }
  return "local";
}

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = parseAutocompletePayload(json);

  if (!parsed.success) {
    return NextResponse.json({ error: { message: parsed.error } }, { status: 400 });
  }

  const ip = resolveClientIp(request);
  if (!takeSlot(ip)) {
    return NextResponse.json({ error: { message: "Quá nhiều yêu cầu." } }, { status: 429 });
  }

  const { input, sessionToken, country, languageCode } = parsed.data;
  const referer = extractReferer(request);

  try {
    const predictions = await fetchAutocomplete(
      {
        input,
        sessionToken,
        regionCode: country,
        languageCode,
      },
      referer,
    );

    return NextResponse.json(
      { predictions },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const baseLog = {
      ts: new Date().toISOString(),
      at: "places.autocomplete_failed",
    };

    if (error instanceof MissingApiKeyError) {
      console.warn(
        JSON.stringify({
          ...baseLog,
          level: "warn",
          kind: "missing_api_key",
        }),
      );

      return NextResponse.json(
        { error: { message: error.message } },
        { status: 500 },
      );
    }

    if (error instanceof PlacesApiError) {
      const status = resolveErrorStatus(error);
      const hints = error.hints;
      const docsPath = error.docsPath;
      console.warn(
        JSON.stringify({
          ...baseLog,
          level: "warn",
          status,
          upstreamStatus: error.status,
          docsPath,
          hints,
          body: error.details,
        }),
      );

      const payload: {
        error: {
          message: string;
          detail?: unknown;
          hints?: string[];
          docsPath?: string;
        };
      } = {
        error: { message: error.message, detail: error.details },
      };

      if (hints?.length) {
        payload.error.hints = hints;
      }

      if (docsPath) {
        payload.error.docsPath = docsPath;
      }

      return NextResponse.json(payload, { status });
    }

    console.error(
      JSON.stringify({
        ...baseLog,
        level: "error",
        kind: "unknown",
        message: error instanceof Error ? error.message : String(error),
      }),
    );

    return NextResponse.json(
      { error: { message: "Không thể gợi ý địa chỉ từ Google." } },
      { status: 502 },
    );
  }
}
