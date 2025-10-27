import "server-only";

import type { PlaceDetails, PlacePrediction } from "../googlePlacesTypes";

const PLACES_BASE_URL = "https://places.googleapis.com/v1";
const AUTOCOMPLETE_FIELD_MASK = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text",
  "suggestions.placePrediction.structuredFormat",
].join(",");
const DETAILS_FIELD_MASK = ["id", "formattedAddress", "displayName", "location"].join(",");
const DEFAULT_LANGUAGE = "vi";
const DEFAULT_REGION = "VN";

export class MissingApiKeyError extends Error {
  constructor() {
    super("Thiếu PLACES_API_KEY. Thiết lập API key Google Places cho server.");
    this.name = "MissingApiKeyError";
  }
}

export class PlacesApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "PlacesApiError";
    this.status = status;
    this.details = details;
  }
}

type AutocompleteRequest = {
  input: string;
  sessionToken?: string;
  languageCode?: string;
  regionCode?: string;
};

type DetailsRequest = {
  placeId: string;
  sessionToken?: string;
  languageCode?: string;
};

type AutocompleteApiResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
};

type DetailsApiResponse = {
  id?: string;
  formattedAddress?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
};

const logJson = (level: "warn" | "error", message: string, extra?: Record<string, unknown>) => {
  // eslint-disable-next-line no-console
  console[level](
    JSON.stringify({
      ts: new Date().toISOString(),
      level,
      msg: message,
      ...extra,
    }),
  );
};

const parseErrorBody = async (res: Response) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

const resolveReferer = (value?: string | null): string | undefined => {
  const candidate = value?.trim();
  return candidate && candidate.length > 0 ? candidate : undefined;
};

const resolvePlacesKey = (): string => {
  const key = process.env.PLACES_API_KEY?.trim();
  if (!key) {
    throw new MissingApiKeyError();
  }
  return key;
};

const applyRefererOptions = (init: RequestInit, referer?: string): RequestInit => {
  if (!referer) return init;
  return {
    ...init,
    referrer: referer,
    referrerPolicy: "no-referrer-when-downgrade",
  } satisfies RequestInit;
};

export async function fetchAutocomplete(
  request: AutocompleteRequest,
  referer?: string,
): Promise<PlacePrediction[]> {
  const trimmed = request.input.trim();
  if (!trimmed) {
    return [];
  }

  const apiKey = resolvePlacesKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
    "X-Goog-FieldMask": AUTOCOMPLETE_FIELD_MASK,
  };

  const resolvedReferer = resolveReferer(referer ?? process.env.GOOGLE_MAPS_REFERER);
  if (resolvedReferer) {
    headers["X-Goog-Referer"] = resolvedReferer;
  }

  const body = {
    input: trimmed,
    languageCode: request.languageCode ?? DEFAULT_LANGUAGE,
    regionCode: request.regionCode ?? DEFAULT_REGION,
    sessionToken: request.sessionToken,
  };

  const response = await fetch(
    `${PLACES_BASE_URL}/places:autocomplete`,
    applyRefererOptions(
      {
        method: "POST",
        cache: "no-store",
        headers,
        body: JSON.stringify(body),
      },
      resolvedReferer,
    ),
  );

  if (!response.ok) {
    const errorBody = await parseErrorBody(response);
    logJson("warn", "places.autocomplete_failed", {
      status: response.status,
      body: errorBody,
    });

    const errorPayload = (errorBody as { error?: { message?: string } } | null)?.error;
    const originalMessage = errorPayload?.message;
    let message =
      originalMessage && originalMessage.length > 0
        ? originalMessage
        : `Places Autocomplete failed (HTTP ${response.status}).`;

    if (response.status === 403 && originalMessage) {
      const normalized = originalMessage.toLowerCase();

      if (normalized.includes("billing") && normalized.includes("enable")) {
        message =
          [
            "Google Places yêu cầu bật Billing cho dự án chứa API key.",
            "Vào Google Cloud Console → Billing, liên kết dự án rồi thử lại.",
          ].join(" ");
      } else if (normalized.includes("referer") || normalized.includes("ip")) {
        message =
          [
            "Google Places key đang bị hạn chế (IP hoặc HTTP referrer) và từ chối yêu cầu.",
            "Kiểm tra lại hạn mức trong Google Cloud Console.",
          ].join(" ");
      }
    }

    throw new PlacesApiError(message, response.status, errorBody ?? undefined);
  }

  const data = (await response.json()) as AutocompleteApiResponse;
  return (data.suggestions ?? [])
    .map((suggestion) => {
      const prediction = suggestion.placePrediction;
      if (!prediction?.placeId) return null;

      const description = prediction.text?.text ?? "";
      const mainText = prediction.structuredFormat?.mainText?.text ?? description;
      const secondaryText = prediction.structuredFormat?.secondaryText?.text;

      return {
        placeId: prediction.placeId,
        description,
        mainText,
        secondaryText,
      } satisfies PlacePrediction;
    })
    .filter(Boolean) as PlacePrediction[];
}

export async function fetchPlaceDetails(
  request: DetailsRequest,
  referer?: string,
): Promise<PlaceDetails> {
  const apiKey = resolvePlacesKey();
  const headers: Record<string, string> = {
    "X-Goog-Api-Key": apiKey,
    "X-Goog-FieldMask": DETAILS_FIELD_MASK,
  };

  const resolvedReferer = resolveReferer(referer ?? process.env.GOOGLE_MAPS_REFERER);
  if (resolvedReferer) {
    headers["X-Goog-Referer"] = resolvedReferer;
  }

  const params = new URLSearchParams();
  if (request.sessionToken) {
    params.set("sessionToken", request.sessionToken);
  }
  if (request.languageCode ?? DEFAULT_LANGUAGE) {
    params.set("languageCode", request.languageCode ?? DEFAULT_LANGUAGE);
  }

  const response = await fetch(
    `${PLACES_BASE_URL}/places/${encodeURIComponent(request.placeId)}?${params.toString()}`,
    applyRefererOptions(
      {
        method: "GET",
        cache: "no-store",
        headers,
      },
      resolvedReferer,
    ),
  );

  if (!response.ok) {
    const errorBody = await parseErrorBody(response);
    logJson("warn", "places.details_failed", {
      status: response.status,
      body: errorBody,
    });
    const message =
      (errorBody as { error?: { message?: string } } | null)?.error?.message ??
      `Places Details failed (HTTP ${response.status}).`;
    throw new PlacesApiError(message, response.status, errorBody ?? undefined);
  }

  const data = (await response.json()) as DetailsApiResponse;
  return {
    formattedAddress: data.formattedAddress,
    name: data.displayName?.text,
    lat: data.location?.latitude,
    lng: data.location?.longitude,
  } satisfies PlaceDetails;
}
