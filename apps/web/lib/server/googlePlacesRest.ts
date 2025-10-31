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
const BILLING_TROUBLESHOOTING_DOC = "docs/google-key-verification.md#smoke-test-proxy";
const ENV_SYNC_DOC = "docs/google-key-verification.md#sync-env-files";
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
  constructor(message = "Thiếu PLACES_API_KEY. Thiết lập API key Google Places cho server.") {
    super(message);
    this.name = "MissingApiKeyError";
  }
}

type PlacesApiErrorOptions = {
  details?: unknown;
  hints?: string[];
  docsPath?: string;
};

export class PlacesApiError extends Error {
  readonly status: number;
  readonly details?: unknown;
  readonly hints?: string[];
  readonly docsPath?: string;

  constructor(message: string, status: number, options: PlacesApiErrorOptions = {}) {
    super(message);
    this.name = "PlacesApiError";
    this.status = status;
    this.details = options.details;
    this.hints = options.hints;
    this.docsPath = options.docsPath;
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
  hints?: string[];
  docsPath?: string;
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

const GOOGLE_ERROR_INFO_TYPE = "type.googleapis.com/google.rpc.ErrorInfo";

const BILLING_DISABLED_REASONS = new Set(["BILLING_DISABLED"]);
const API_KEY_RESTRICTION_REASONS = new Set([
  "API_KEY_HTTP_REFERRER_BLOCKED",
  "API_KEY_IP_ADDRESS_BLOCKED",
  "API_KEY_INVALID",
  "API_KEY_API_TARGET_BLOCKED",
]);

const normalizeProjectIdentifier = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const projectMatch = trimmed.match(/^projects\/(.+)$/i);
  if (projectMatch && projectMatch[1]) {
    const normalized = projectMatch[1].trim();
    return normalized ? normalized : null;
  }

  return trimmed;
};

const extractErrorReasons = (payload: unknown): string[] => {
  const details =
    (payload as { error?: { details?: unknown } } | null)?.error?.details ?? null;
  if (!Array.isArray(details)) {
    return [];
  }

  const reasons: string[] = [];
  for (const detail of details) {
    if (!detail || typeof detail !== "object") {
      continue;
    }

    const errorInfoType = (detail as { [key: string]: unknown })["@type"];
    if (errorInfoType !== GOOGLE_ERROR_INFO_TYPE) {
      continue;
    }

    const reason = (detail as { reason?: unknown }).reason;
    if (typeof reason !== "string") {
      continue;
    }

    const trimmed = reason.trim();
    if (!trimmed) {
      continue;
    }

    reasons.push(trimmed.toUpperCase());
  }

  return reasons;
};

const extractBillingProject = (payload: unknown): string | null => {
  const details =
    (payload as { error?: { details?: unknown } } | null)?.error?.details ?? null;
  if (!Array.isArray(details)) {
    return null;
  }

  for (const detail of details) {
    if (!detail || typeof detail !== "object") {
      continue;
    }

    const errorInfoType = (detail as { [key: string]: unknown })["@type"];
    if (errorInfoType !== GOOGLE_ERROR_INFO_TYPE) {
      continue;
    }

    const metadata = (detail as { metadata?: unknown }).metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      continue;
    }

    const candidateValues = [
      (metadata as { consumer?: unknown }).consumer,
      (metadata as { containerInfo?: unknown }).containerInfo,
    ];

    for (const candidate of candidateValues) {
      if (typeof candidate !== "string") {
        continue;
      }

      const normalized = normalizeProjectIdentifier(candidate);
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
};

const resolveReferer = (value?: string | null): string | undefined => {
  const candidate = value?.trim();
  return candidate && candidate.length > 0 ? candidate : undefined;
};

const stripEnvValue = (value: string): string => {
  let trimmed = value.trim();
  if (!trimmed) return "";

  const isWrappedInDoubleQuotes = trimmed.startsWith("\"") && trimmed.endsWith("\"");
  const isWrappedInSingleQuotes = trimmed.startsWith("'") && trimmed.endsWith("'");

  if (isWrappedInDoubleQuotes || isWrappedInSingleQuotes) {
    return trimmed.slice(1, -1).trim();
  }

  const inlineCommentIndex = trimmed.indexOf(" #");
  if (inlineCommentIndex >= 0) {
    trimmed = trimmed.slice(0, inlineCommentIndex).trimEnd();
  }

  return trimmed;
};

const extractKeyFromEnvFile = (contents: string): string | null => {
  const lines = contents.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^(?:export\s+)?PLACES_API_KEY\s*=\s*(.+)$/);
    if (!match) {
      continue;
    }

    const candidate = stripEnvValue(match[1]);
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

export const __testing_extractKeyFromEnvFile = (contents: string): string | null =>
  extractKeyFromEnvFile(contents);

const finalizeResolvedKey = (key: string, source: string): string => {
  cachedApiKey = key;
  cachedApiKeySource = source;
  return cachedApiKey;
};

const resolvePlacesKey = (): string => {
  if (cachedApiKey) {
    return cachedApiKey;
  }

  const primary = process.env.PLACES_API_KEY?.trim();
  if (primary) {
    return finalizeResolvedKey(primary, "PLACES_API_KEY");
  }

  for (const fallbackKey of FALLBACK_KEY_ENV_KEYS) {
    const candidate = process.env[fallbackKey]?.trim();
    if (!candidate) {
      continue;
    }

    if (cachedApiKeySource !== fallbackKey) {
      logJson("warn", "places.fallback_env_used", { fallbackKey });
    }

    return finalizeResolvedKey(candidate, fallbackKey);
  }

  const fileCandidate = resolvePlacesKeyFromFiles();
  if (fileCandidate) {
    const sourceId = `file:${fileCandidate.source}`;
    if (cachedApiKeySource !== sourceId) {
      logJson("warn", "places.env_file_fallback", { path: fileCandidate.source });
    }
    return finalizeResolvedKey(fileCandidate.key, sourceId);
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
  new PlacesApiError(entry.message, entry.status, {
    details: entry.details,
    hints: entry.hints,
    docsPath: entry.docsPath,
  });

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
  options?: { hints?: string[]; docsPath?: string },
) => {
  cachedFailure = {
    status,
    message,
    details,
    until: Date.now() + ttl,
    hints: options?.hints,
    docsPath: options?.docsPath,
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
    const errorReasons = extractErrorReasons(errorBody);
    let message =
      originalMessage && originalMessage.length > 0
        ? originalMessage
        : `Places Autocomplete failed (HTTP ${response.status}).`;

    let circuitTtl: number | null = null;
    const hints: string[] = [];
    let docsPath: string | undefined;

    if (response.status === 403) {
      const normalized = originalMessage?.toLowerCase() ?? "";
      const hasBillingReason = errorReasons.some((reason) =>
        BILLING_DISABLED_REASONS.has(reason),
      );
      const hasRestrictionReason = errorReasons.some((reason) =>
        API_KEY_RESTRICTION_REASONS.has(reason),
      );

      if (
        hasBillingReason ||
        (normalized.includes("billing") && normalized.includes("enable"))
      ) {
        const billingProject = extractBillingProject(errorBody);
        const projectDescriptor =
          billingProject && billingProject.length > 0
            ? ` (project ${billingProject})`
            : "";

        message =
          [
            `Google Places yêu cầu bật Billing cho dự án chứa API key${projectDescriptor}.`,
            "Vào Google Cloud Console → Billing, liên kết dự án rồi thử lại.",
          ].join(" ");
        circuitTtl = BILLING_CIRCUIT_TIMEOUT_MS;
        hints.push(
          billingProject
            ? `Đảm bảo dự án ${billingProject} đã liên kết Billing account trong Google Cloud Console (Billing → Account management).`
            : "Bật Billing cho project chứa Places API key trong Google Cloud Console (Menu → Billing).",
          "Đợi 1-3 phút sau khi bật Billing rồi chạy lại curl trực tiếp tới https://places.googleapis.com/v1/places:autocomplete với header X-Goog-Api-Key để kiểm tra.",
        );
        if (billingProject) {
          hints.push(
            `Xác nhận API key đang sử dụng thuộc dự án ${billingProject} trong Google Cloud Console → APIs & Services → Credentials.`,
          );
        }
        docsPath = BILLING_TROUBLESHOOTING_DOC;
      } else if (
        hasRestrictionReason ||
        normalized.includes("referer") ||
        normalized.includes("ip")
      ) {
        message =
          [
            "Google Places key đang bị hạn chế (IP hoặc HTTP referrer) và từ chối yêu cầu.",
            "Kiểm tra lại hạn mức trong Google Cloud Console.",
          ].join(" ");
        circuitTtl = GENERIC_CIRCUIT_TIMEOUT_MS;
        hints.push(
          "Kiểm tra danh sách IP/referrer được phép của key server trong Google Cloud Console → API Keys.",
          "Đảm bảo biến môi trường PLACES_API_KEY tồn tại trong tiến trình Next.js (ví dụ apps/web/.env.local).",
        );
        docsPath = ENV_SYNC_DOC;
      }
    }

    const normalizedHints = hints.length > 0 ? [...new Set(hints)] : undefined;
    const errorDetails = errorBody ?? undefined;

    if (response.status === 403 && circuitTtl) {
      rememberFailure(response.status, message, errorDetails, circuitTtl, {
        hints: normalizedHints,
        docsPath,
      });
      throw new PlacesApiError(message, response.status, {
        details: errorDetails,
        hints: normalizedHints,
        docsPath,
      });
    }

    throw new PlacesApiError(message, response.status, {
      details: errorDetails,
      hints: normalizedHints,
      docsPath,
    });
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
    const errorReasons = extractErrorReasons(errorBody);
    let message =
      originalMessage && originalMessage.length > 0
        ? originalMessage
        : `Places Details failed (HTTP ${response.status}).`;

    let circuitTtl: number | null = null;
    const hints: string[] = [];
    let docsPath: string | undefined;

    if (response.status === 403) {
      const normalized = originalMessage?.toLowerCase() ?? "";
      const hasBillingReason = errorReasons.some((reason) =>
        BILLING_DISABLED_REASONS.has(reason),
      );
      const hasRestrictionReason = errorReasons.some((reason) =>
        API_KEY_RESTRICTION_REASONS.has(reason),
      );

      if (
        hasBillingReason ||
        (normalized.includes("billing") && normalized.includes("enable"))
      ) {
        const billingProject = extractBillingProject(errorBody);
        const projectDescriptor =
          billingProject && billingProject.length > 0
            ? ` (project ${billingProject})`
            : "";

        message =
          [
            `Google Places yêu cầu bật Billing cho dự án chứa API key${projectDescriptor}.`,
            "Vào Google Cloud Console → Billing, liên kết dự án rồi thử lại.",
          ].join(" ");
        circuitTtl = BILLING_CIRCUIT_TIMEOUT_MS;
        hints.push(
          billingProject
            ? `Đảm bảo dự án ${billingProject} đã liên kết Billing account trong Google Cloud Console (Billing → Account management).`
            : "Bật Billing cho project chứa Places API key trong Google Cloud Console (Menu → Billing).",
          "Đợi 1-3 phút sau khi bật Billing rồi chạy lại curl trực tiếp tới https://places.googleapis.com/v1/places:autocomplete với header X-Goog-Api-Key để kiểm tra.",
        );
        if (billingProject) {
          hints.push(
            `Xác nhận API key đang sử dụng thuộc dự án ${billingProject} trong Google Cloud Console → APIs & Services → Credentials.`,
          );
        }
        docsPath = BILLING_TROUBLESHOOTING_DOC;
      } else if (
        hasRestrictionReason ||
        normalized.includes("referer") ||
        normalized.includes("ip")
      ) {
        message =
          [
            "Google Places key đang bị hạn chế (IP hoặc HTTP referrer) và từ chối yêu cầu.",
            "Kiểm tra lại hạn mức trong Google Cloud Console.",
          ].join(" ");
        circuitTtl = GENERIC_CIRCUIT_TIMEOUT_MS;
        hints.push(
          "Kiểm tra danh sách IP/referrer được phép của key server trong Google Cloud Console → API Keys.",
          "Đảm bảo biến môi trường PLACES_API_KEY tồn tại trong tiến trình Next.js (ví dụ apps/web/.env.local).",
        );
        docsPath = ENV_SYNC_DOC;
      }
    }

    const normalizedHints = hints.length > 0 ? [...new Set(hints)] : undefined;
    const errorDetails = errorBody ?? undefined;

    if (response.status === 403 && circuitTtl) {
      rememberFailure(response.status, message, errorDetails, circuitTtl, {
        hints: normalizedHints,
        docsPath,
      });
      throw new PlacesApiError(message, response.status, {
        details: errorDetails,
        hints: normalizedHints,
        docsPath,
      });
    }

    throw new PlacesApiError(message, response.status, {
      details: errorDetails,
      hints: normalizedHints,
      docsPath,
    });
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
