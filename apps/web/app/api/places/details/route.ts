import { NextRequest, NextResponse } from "next/server";

import {
  MissingApiKeyError,
  PlacesApiError,
  fetchPlaceDetails,
} from "../../../../lib/server/googlePlacesRest";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type DetailsPayload = {
  placeId: string;
  sessionToken?: string;
  languageCode?: string;
};

type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

function parseDetailsPayload(payload: unknown): ValidationResult<DetailsPayload> {
  if (!payload || typeof payload !== "object") {
    return { success: false, error: "Payload không hợp lệ." };
  }

  const { placeId, sessionToken, languageCode } = payload as Record<string, unknown>;

  if (typeof placeId !== "string" || placeId.trim().length === 0) {
    return { success: false, error: "Thiếu placeId." };
  }

  if (sessionToken !== undefined && typeof sessionToken !== "string") {
    return { success: false, error: "sessionToken phải là chuỗi." };
  }

  if (languageCode !== undefined) {
    if (typeof languageCode !== "string" || languageCode.length < 2 || languageCode.length > 10) {
      return { success: false, error: "languageCode phải từ 2-10 ký tự." };
    }
  }

  return {
    success: true,
    data: {
      placeId,
      sessionToken: typeof sessionToken === "string" ? sessionToken : undefined,
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

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = parseDetailsPayload(json);

  if (!parsed.success) {
    return NextResponse.json({ error: { message: parsed.error } }, { status: 400 });
  }

  const { placeId, sessionToken, languageCode } = parsed.data;
  const referer = extractReferer(request);

  try {
    const details = await fetchPlaceDetails(placeId, {
      sessionToken,
      languageCode,
      referer,
    });

    return NextResponse.json(
      { details },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 503 },
      );
    }

    if (error instanceof PlacesApiError) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: Math.max(error.status, 400) },
      );
    }

    console.error("Google Places details proxy error", error);
    return NextResponse.json(
      { error: { message: "Không thể lấy chi tiết địa điểm từ Google." } },
      { status: 502 },
    );
  }
}
