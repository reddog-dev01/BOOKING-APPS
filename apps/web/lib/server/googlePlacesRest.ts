/**
 * Google Places server helpers (v1 – Places API (New))
 * - Autocomplete: POST https://places.googleapis.com/v1/places:autocomplete
 * - Details:      GET  https://places.googleapis.com/v1/places/{placeId} (yêu cầu Field Mask)
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

type ResponseLike = {
  ok: boolean;
  status: number;
  text?: () => Promise<string>;
  json?: () => Promise<unknown>;
};

type PlacesKeySource = {
  value: string;
  source: string;
};

type EnvFileResult = { key: string; source: string } | null;

type AutocompleteParams = {
  input: string;
  languageCode?: string; // ví dụ 'vi'
  regionCode?: string; // ví dụ 'VN'
  sessionToken?: string;
};

type PlaceDetailsParams = {
  placeId: string;
  fieldMask?: string;
  sessionToken?: string;
  languageCode?: string;
};

const PLACES_ENDPOINT_AUTOCOMPLETE = "https://places.googleapis.com/v1/places:autocomplete";
const PLACES_ENDPOINT_DETAILS = (id: string) =>
  `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`;
const DEFAULT_FIELD_MASK = "id,displayName,formattedAddress,location";
const BILLING_CIRCUIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ERROR_BODY_LENGTH = 2_000;
const BILLING_ERROR_MESSAGE =
  "Google Places yêu cầu bật Billing cho dự án chứa API key.";
const PLACEHOLDER_KEYS = new Set([
  "__REPLACE_WITH_GOOGLE_PLACES_KEY__",
  "AIzaSyDGGWT-KId7wbuqbq9apUaXRUutjrJOkWI",
]);
const PROCESS_ENV_CANDIDATES: Array<{
  key: string;
  label: string;
  warnOnUse: boolean;
}> = [
  { key: "PLACES_API_KEY", label: "process.env.PLACES_API_KEY", warnOnUse: false },
  {
    key: "GOOGLE_PLACES_API_KEY",
    label: "process.env.GOOGLE_PLACES_API_KEY",
    warnOnUse: true,
  },
  {
    key: "GOOGLE_MAPS_API_KEY",
    label: "process.env.GOOGLE_MAPS_API_KEY",
    warnOnUse: true,
  },
  {
    key: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
    label: "process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
    warnOnUse: true,
  },
];
const DEFAULT_ENV_FILES = [
  "apps/web/.env.local",
  "apps/web/.env",
  ".env.local",
  ".env",
  "apps/api/.env",
  "apps/api/.env.local",
  "apps/admin/.env.local",
];

let placesKeyCache: PlacesKeySource | null = null;
let billingCircuitOpenUntil = 0;
let placeholderWarningIssuedFor: string | null = null;
let envFileResolverOverride: (() => EnvFileResult) | undefined;

export class MissingApiKeyError extends Error {
  constructor() {
    super("PLACES_API_KEY missing");
  }
}

export class PlacesApiError extends Error {
  status: number;
  body?: string;

  constructor(options: { status: number; message?: string; body?: string }) {
    super(options.message ?? `Google Places API error (status=${options.status})`);
    this.status = options.status;
    this.body = options.body;
  }
}

function logWarn(payload: Record<string, unknown>) {
  try {
    console.warn(JSON.stringify(payload));
  } catch {
    console.warn(payload);
  }
}

function detectRepoRoot(): string {
  const cwd = process.cwd();
  const candidates = [cwd, path.resolve(cwd, ".."), path.resolve(cwd, "../..")];

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "apps"))) {
      return candidate;
    }
  }

  return cwd;
}

const repoRoot = detectRepoRoot();

function readEnvFile(filePath: string): string | null {
  try {
    return readFileSync(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export function __testing_extractKeyFromEnvFile(content: string): string | null {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (key !== "PLACES_API_KEY") {
      continue;
    }

    let value = rawValue.trim();
    if (value.startsWith("\"") || value.startsWith("'")) {
      const quote = value[0];
      const closingIndex = value.indexOf(quote, 1);
      if (closingIndex !== -1) {
        value = value.slice(1, closingIndex);
      } else {
        value = value.slice(1);
      }
    } else {
      const commentIndex = value.indexOf("#");
      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex).trim();
      }
    }

    if (value) {
      return value;
    }
  }

  return null;
}

function defaultEnvFileResolver(): EnvFileResult {
  for (const relative of DEFAULT_ENV_FILES) {
    const absolute = path.resolve(repoRoot, relative);
    const content = readEnvFile(absolute);
    if (!content) {
      continue;
    }

    const key = __testing_extractKeyFromEnvFile(content);
    if (key) {
      return { key, source: relative };
    }
  }

  return null;
}

function resolvePlacesKeyFromProcessEnv(): PlacesKeySource | null {
  for (const candidate of PROCESS_ENV_CANDIDATES) {
    const value = process.env[candidate.key]?.trim();
    if (value) {
      if (candidate.warnOnUse) {
        logWarn({ msg: "places.fallback_env_used", source: candidate.label });
      }
      return { value, source: candidate.label };
    }
  }
  return null;
}

function resolvePlacesKeyFromFiles(): PlacesKeySource | null {
  const resolver = envFileResolverOverride ?? defaultEnvFileResolver;
  if (!resolver) {
    return null;
  }

  const result = resolver();
  if (result) {
    logWarn({ msg: "places.env_file_fallback", source: result.source });
    return { value: result.key, source: result.source };
  }

  return null;
}

function maybeWarnPlaceholder(key: string, source: string) {
  if (!PLACEHOLDER_KEYS.has(key)) {
    return;
  }
  if (placeholderWarningIssuedFor === key) {
    return;
  }

  placeholderWarningIssuedFor = key;
  logWarn({ msg: "places.placeholder_key_detected", source });
}

function resolvePlacesApiKey(): string {
  if (placesKeyCache) {
    return placesKeyCache.value;
  }

  const fromProcess = resolvePlacesKeyFromProcessEnv();
  if (fromProcess) {
    placesKeyCache = fromProcess;
    maybeWarnPlaceholder(fromProcess.value, fromProcess.source);
    return fromProcess.value;
  }

  const fromFile = resolvePlacesKeyFromFiles();
  if (fromFile) {
    placesKeyCache = fromFile;
    maybeWarnPlaceholder(fromFile.value, fromFile.source);
    return fromFile.value;
  }

  throw new MissingApiKeyError();
}

function truncate(body?: string | null): string | undefined {
  if (!body) {
    return undefined;
  }
  if (body.length <= MAX_ERROR_BODY_LENGTH) {
    return body;
  }
  return `${body.slice(0, MAX_ERROR_BODY_LENGTH)}…`;
}

function createBillingError(): PlacesApiError {
  return new PlacesApiError({ status: 503, message: BILLING_ERROR_MESSAGE });
}

function tripBillingCircuit(reason: "api_response" | "circuit_open") {
  billingCircuitOpenUntil = Date.now() + BILLING_CIRCUIT_WINDOW_MS;
  logWarn({
    msg: "places.billing_disabled",
    reason,
    circuitOpenUntil: new Date(billingCircuitOpenUntil).toISOString(),
  });
}

function ensureCircuitClosed() {
  if (billingCircuitOpenUntil > Date.now()) {
    tripBillingCircuit("circuit_open");
    throw createBillingError();
  }
}

function looksLikeBillingDisabled(status: number, body: string | undefined, parsed: unknown): boolean {
  if (status !== 403) {
    return false;
  }

  const text = body?.toLowerCase() ?? "";
  if (text.includes("billing") && (text.includes("disable") || text.includes("enable"))) {
    return true;
  }

  const errorStatus =
    typeof parsed === "object" && parsed !== null && "error" in parsed
      ? (parsed as { error?: { status?: string } }).error?.status
      : undefined;
  return typeof errorStatus === "string" && errorStatus.toUpperCase().includes("BILLING");
}

async function readResponseBody(res: ResponseLike): Promise<{ raw?: string; parsed?: unknown }> {
  if (typeof res.text === "function") {
    const raw = await res.text();
    try {
      return { raw, parsed: raw ? JSON.parse(raw) : undefined };
    } catch {
      return { raw };
    }
  }

  if (typeof res.json === "function") {
    const parsed = await res.json();
    const raw =
      typeof parsed === "string" ? parsed : parsed !== undefined ? JSON.stringify(parsed) : undefined;
    return { raw, parsed };
  }

  return {};
}

async function executePlacesRequest(
  url: string,
  init: RequestInit & { headers: Record<string, string> },
): Promise<{ parsed?: unknown }> {
  ensureCircuitClosed();
  const res = await fetch(url, init);
  const { raw, parsed } = await readResponseBody(res as ResponseLike);

  if (!res.ok) {
    if (looksLikeBillingDisabled(res.status, raw, parsed)) {
      tripBillingCircuit("api_response");
      throw createBillingError();
    }

    throw new PlacesApiError({ status: res.status, body: truncate(raw) });
  }

  return { parsed };
}

export async function fetchAutocomplete(params: AutocompleteParams, _referer?: string) {
  const apiKey = resolvePlacesApiKey();

  const payload: Record<string, unknown> = {
    input: params.input,
    languageCode: params.languageCode ?? "vi",
  };
  if (params.regionCode) payload.regionCode = params.regionCode;
  if (params.sessionToken) payload.sessionToken = params.sessionToken;

  const { parsed } = await executePlacesRequest(PLACES_ENDPOINT_AUTOCOMPLETE, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const data = parsed as
    | { suggestions?: unknown[]; predictions?: unknown[] }
    | undefined
    | null;
  if (!data) {
    return [];
  }

  return data.suggestions ?? data.predictions ?? [];
}

export async function fetchPlaceDetails(params: PlaceDetailsParams, _referer?: string) {
  const apiKey = resolvePlacesApiKey();
  const url = new URL(PLACES_ENDPOINT_DETAILS(params.placeId));

  if (params.sessionToken) {
    url.searchParams.set("sessionToken", params.sessionToken);
  }
  if (params.languageCode) {
    url.searchParams.set("languageCode", params.languageCode);
  }

  const { parsed } = await executePlacesRequest(url.toString(), {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": params.fieldMask ?? DEFAULT_FIELD_MASK,
    },
  });

  return parsed;
}

export function resetPlacesCircuitBreakerForTests() {
  billingCircuitOpenUntil = 0;
}

export function resetPlacesKeyCacheForTests() {
  placesKeyCache = null;
  placeholderWarningIssuedFor = null;
}

export function setPlacesKeyFileResolverForTests(resolver: (() => EnvFileResult) | null) {
  if (resolver === null) {
    envFileResolverOverride = undefined;
    return;
  }
  envFileResolverOverride = resolver;
}
