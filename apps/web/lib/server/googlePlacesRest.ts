import "server-only";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
const BILLING_CIRCUIT_TIMEOUT_MS = 10 * 60 * 1000;
const GENERIC_CIRCUIT_TIMEOUT_MS = 60 * 1000;
const FALLBACK_KEY_ENV_KEYS = [
  "GOOGLE_PLACES_API_KEY",
  "GOOGLE_MAPS_API_KEY",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
] as const;
const FALLBACK_KEY_FILE_PATHS = [
  ".env.local",
  ".env",
  "apps/web/.env.local",
  "apps/web/.env",
  "apps/api/.env",
  "apps/api/.env.local",
  "apps/admin/.env.local",
] as const;

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

type CachedFailure = {
  until: number;
  status: number;
  message: string;
  details?: unknown;
};

type PlacesKeyFileCandidate = { key: string; source: string };

let cachedFailure: CachedFailure | null = null;
let cachedApiKey: string | null = null;
let cachedApiKeySource: string | null = null;

const resetPlacesApiKeyCache = () => {
  cachedApiKey = null;
  cachedApiKeySource = null;
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

const stripEnvValue = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const isWrappedInDoubleQuotes = trimmed.startsWith("\"") && trimmed.endsWith("\"");
  const isWrappedInSingleQuotes = trimmed.startsWith("\'") && trimmed.endsWith("\'");

  if (isWrappedInDoubleQuotes || isWrappedInSingleQuotes) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
};

const extractKeyFromEnvFile = (contents: string): string | null => {
  const lines = contents.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [rawKey, ...rest] = trimmed.split("=");
    if (!rawKey || rawKey.trim() !== "PLACES_API_KEY") {
      continue;
    }
    const candidate = stripEnvValue(rest.join("="));
    if (candidate) {
      return candidate;
    }
  }
  return null;
};

const defaultResolvePlacesKeyFromFiles = (): PlacesKeyFileCandidate | null => {
  for (const relativePath of FALLBACK_KEY_FILE_PATHS) {
    const absolutePath = resolve(process.cwd(), relativePath);
    try {
      const contents = readFileSync(absolutePath, "utf8");
      const candidate = extractKeyFromEnvFile(contents);
      if (candidate) {
        return { key: candidate, source: relativePath } satisfies PlacesKeyFileCandidate;
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code && err.code !== "ENOENT") {
        logJson("warn", "places.env_file_read_failed", {
          path: relativePath,
          code: err.code,
          message: err.message,
        });
      }
    }
  }

  return null;
};

let resolvePlacesKeyFromFilesImpl = defaultResolvePlacesKeyFromFiles;

const resolvePlacesKeyFromFiles = (): PlacesKeyFileCandidate | null =>
  resolvePlacesKeyFromFilesImpl();

const resolvePlacesKey = (): string => {
  if (cachedApiKey) {
    return cachedApiKey;
  }

  const primary = process.env.PLACES_API_KEY?.trim();
  if (primary) {
    cachedApiKey = primary;
    cachedApiKeySource = "PLACES_API_KEY";
    return cachedApiKey;
  }

  for (const fallbackKey of FALLBACK_KEY_ENV_KEYS) {
    const candidate = process.env[fallbackKey]?.trim();
    if (!candidate) {
      continue;
    }

    if (cachedApiKeySource !== fallbackKey) {
      logJson("warn", "places.fallback_env_used", { fallbackKey });
    }

    cachedApiKey = candidate;
    cachedApiKeySource = fallbackKey;
    return cachedApiKey;
  }

  const fileCandidate = resolvePlacesKeyFromFiles();
  if (fileCandidate) {
    const sourceId = `file:${fileCandidate.source}`;
    if (cachedApiKeySource !== sourceId) {
      logJson("warn", "places.env_file_fallback", { path: fileCandidate.source });
    }
    cachedApiKey = fileCandidate.key;
    cachedApiKeySource = sourceId;
    return cachedApiKey;
  }

  throw new MissingApiKeyError();
};

const applyRefererOptions = (init: RequestInit, referer?: string): RequestInit => {
  if (!referer) return init;
  return {
    ...init,
    referrer: referer,
    referrerPolicy: "no-referrer-when-downgrade",
  } satisfies RequestInit;
};

const clonePlacesError = (entry: CachedFailure): PlacesApiError =>
  new PlacesApiError(entry.message, entry.status, entry.details);

const resolveCachedFailure = (): PlacesApiError | null => {
  if (!cachedFailure) return null;
  if (Date.now() < cachedFailure.until) {
    return clonePlacesError(cachedFailure);
  }

  cachedFailure = null;
  return null;
};

const rememberFailure = (
  status: number,
  message: string,
  details: unknown,
  ttl: number,
) => {
  cachedFailure = {
    status,
    message,
    details,
    until: Date.now() + ttl,
  } satisfies CachedFailure;
};

const clearFailure = () => {
  cachedFailure = null;
};

export const resetPlacesCircuitBreakerForTests = () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("resetPlacesCircuitBreakerForTests is only available in tests");
  }
  clearFailure();
};

export const resetPlacesKeyCacheForTests = () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("resetPlacesKeyCacheForTests is only available in tests");
  }
  resetPlacesApiKeyCache();
};

export const setPlacesKeyFileResolverForTests = (
  resolver: (() => PlacesKeyFileCandidate | null) | null,
) => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("setPlacesKeyFileResolverForTests is only available in tests");
  }
  resolvePlacesKeyFromFilesImpl = resolver ?? defaultResolvePlacesKeyFromFiles;
  resetPlacesApiKeyCache();
};

export async function fetchAutocomplete(
  request: AutocompleteRequest,
  referer?: string,
): Promise<PlacePrediction[]> {
  const trimmed = request.input.trim();
  if (!trimmed) {
    return [];
  }

  const cachedError = resolveCachedFailure();
  if (cachedError) {
    throw cachedError;
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

    let circuitTtl: number | null = null;
    let circuitStatus = Math.max(response.status, 400);

    if (response.status === 403 && originalMessage) {
      const normalized = originalMessage.toLowerCase();

      if (normalized.includes("billing") && normalized.includes("enable")) {
        message =
          [
            "Google Places yêu cầu bật Billing cho dự án chứa API key.",
            "Vào Google Cloud Console → Billing, liên kết dự án rồi thử lại.",
          ].join(" ");
        circuitTtl = BILLING_CIRCUIT_TIMEOUT_MS;
        circuitStatus = 403;
      } else if (normalized.includes("referer") || normalized.includes("ip")) {
        message =
          [
            "Google Places key đang bị hạn chế (IP hoặc HTTP referrer) và từ chối yêu cầu.",
            "Kiểm tra lại hạn mức trong Google Cloud Console.",
          ].join(" ");
        circuitTtl = GENERIC_CIRCUIT_TIMEOUT_MS;
      }
    }

    if (response.status === 403 && circuitTtl) {
      rememberFailure(circuitStatus, message, errorBody ?? undefined, circuitTtl);
      throw new PlacesApiError(message, circuitStatus, errorBody ?? undefined);
    }

    throw new PlacesApiError(message, response.status, errorBody ?? undefined);
  }

  const data = (await response.json()) as AutocompleteApiResponse;
  clearFailure();
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
  const cachedError = resolveCachedFailure();
  if (cachedError) {
    throw cachedError;
  }

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
    const errorPayload = (errorBody as { error?: { message?: string } } | null)?.error;
    const originalMessage = errorPayload?.message;
    let message =
      originalMessage && originalMessage.length > 0
        ? originalMessage
        : `Places Details failed (HTTP ${response.status}).`;

    let circuitTtl: number | null = null;
    let circuitStatus = Math.max(response.status, 400);

    if (response.status === 403 && originalMessage) {
      const normalized = originalMessage.toLowerCase();

      if (normalized.includes("billing") && normalized.includes("enable")) {
        message =
          [
            "Google Places yêu cầu bật Billing cho dự án chứa API key.",
            "Vào Google Cloud Console → Billing, liên kết dự án rồi thử lại.",
          ].join(" ");
        circuitTtl = BILLING_CIRCUIT_TIMEOUT_MS;
        circuitStatus = 403;
      } else if (normalized.includes("referer") || normalized.includes("ip")) {
        message =
          [
            "Google Places key đang bị hạn chế (IP hoặc HTTP referrer) và từ chối yêu cầu.",
            "Kiểm tra lại hạn mức trong Google Cloud Console.",
          ].join(" ");
        circuitTtl = GENERIC_CIRCUIT_TIMEOUT_MS;
      }
    }

    if (response.status === 403 && circuitTtl) {
      rememberFailure(circuitStatus, message, errorBody ?? undefined, circuitTtl);
      throw new PlacesApiError(message, circuitStatus, errorBody ?? undefined);
    }

    throw new PlacesApiError(message, response.status, errorBody ?? undefined);
  }

  const data = (await response.json()) as DetailsApiResponse;
  clearFailure();
  return {
    formattedAddress: data.formattedAddress,
    name: data.displayName?.text,
    lat: data.location?.latitude,
    lng: data.location?.longitude,
  } satisfies PlaceDetails;
}
