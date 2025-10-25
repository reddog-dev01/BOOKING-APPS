const NEW_PLACES_BASE_URL = "https://places.googleapis.com/v1";
const LEGACY_PLACES_BASE_URL = "https://maps.googleapis.com/maps/api/place";
const FIELD_MASK_AUTOCOMPLETE = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text",
  "suggestions.placePrediction.structuredFormat",
].join(",");
const FIELD_MASK_DETAILS = [
  "id",
  "formattedAddress",
  "displayName",
  "location",
].join(",");

class PlacesApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "PlacesApiError";
    this.status = status;
    this.details = details;
  }
}

export type RestPrediction = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText?: string;
};

export type RestPlaceDetails = {
  formattedAddress?: string;
  name?: string;
  lat?: number;
  lng?: number;
};

function getApiKey(): string {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
  }
  return apiKey;
}

async function buildError(res: Response, fallback: string) {
  const body = await res
    .json()
    .catch(() => null);

  const message = body?.error?.message ? (body.error.message as string) : fallback;
  throw new PlacesApiError(message, res.status, body);
}

function shouldFallbackToLegacy(error: unknown): boolean {
  if (!(error instanceof PlacesApiError)) {
    return false;
  }

  if (error.status === 403 || error.status === 400) {
    const message = error.message.toLowerCase();
    if (message.includes("billing") || message.includes("api method requires billing")) {
      return true;
    }

    // Legacy API key restrictions may surface as PERMISSION_DENIED.
    if (typeof error.details === "object" && error.details !== null) {
      const status = (error.details as { error?: { status?: string } })?.error?.status;
      if (status === "PERMISSION_DENIED" || status === "FAILED_PRECONDITION") {
        return true;
      }
    }
  }

  return false;
}

async function callNewAutocomplete(
  input: string,
  sessionToken: string | undefined,
  country: string,
  languageCode: string,
) {
  const res = await fetch(`${NEW_PLACES_BASE_URL}/places:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": FIELD_MASK_AUTOCOMPLETE,
    },
    body: JSON.stringify({
      input,
      languageCode,
      regionCode: country,
      components: { countries: [country] },
      sessionToken,
    }),
  });

  if (!res.ok) {
    await buildError(
      res,
      `Google Places autocomplete failed (HTTP ${res.status}).`,
    );
  }

  const data = (await res.json()) as {
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

  const suggestions = data.suggestions ?? [];
  return suggestions
    .map((item) => {
      const prediction = item.placePrediction;
      if (!prediction?.placeId) return null;
      const description = prediction.text?.text ?? "";
      const mainText = prediction.structuredFormat?.mainText?.text ?? description;
      const secondaryText = prediction.structuredFormat?.secondaryText?.text;
      return {
        placeId: prediction.placeId,
        description,
        mainText,
        secondaryText,
      } as RestPrediction;
    })
    .filter((value): value is RestPrediction => Boolean(value));
}

async function callLegacyAutocomplete(
  input: string,
  sessionToken: string | undefined,
  country: string,
  languageCode: string,
) {
  const params = new URLSearchParams({
    input,
    key: getApiKey(),
    language: languageCode,
  });
  if (sessionToken) {
    params.set("sessiontoken", sessionToken);
  }
  if (country) {
    params.append("components", `country:${country}`);
  }

  const res = await fetch(`${LEGACY_PLACES_BASE_URL}/autocomplete/json?${params.toString()}`);

  if (!res.ok) {
    await buildError(
      res,
      `Google Places autocomplete (legacy) failed (HTTP ${res.status}).`,
    );
  }

  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    predictions?: Array<{
      place_id?: string;
      description?: string;
      structured_formatting?: {
        main_text?: string;
        secondary_text?: string;
      };
    }>;
  };

  if (data.status && data.status !== "OK") {
    throw new PlacesApiError(
      data.error_message ?? `Google Places autocomplete (legacy) failed (${data.status}).`,
      400,
      data,
    );
  }

  return (data.predictions ?? [])
    .map((prediction) => {
      if (!prediction.place_id) return null;
      const description = prediction.description ?? "";
      return {
        placeId: prediction.place_id,
        description,
        mainText: prediction.structured_formatting?.main_text ?? description,
        secondaryText: prediction.structured_formatting?.secondary_text,
      } as RestPrediction;
    })
    .filter((value): value is RestPrediction => Boolean(value));
}

async function callNewDetails(
  placeId: string,
  sessionToken: string | undefined,
  languageCode: string,
) {
  const encoded = encodeURIComponent(placeId);
  const searchParams = new URLSearchParams({ languageCode });
  if (sessionToken) {
    searchParams.set("sessionToken", sessionToken);
  }

  const res = await fetch(`${NEW_PLACES_BASE_URL}/places/${encoded}?${searchParams}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": FIELD_MASK_DETAILS,
    },
  });

  if (!res.ok) {
    await buildError(
      res,
      `Google Places details failed (HTTP ${res.status}).`,
    );
  }

  const data = (await res.json()) as {
    formattedAddress?: string;
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
  };

  return {
    formattedAddress: data.formattedAddress,
    name: data.displayName?.text,
    lat: data.location?.latitude,
    lng: data.location?.longitude,
  } satisfies RestPlaceDetails;
}

async function callLegacyDetails(
  placeId: string,
  sessionToken: string | undefined,
  languageCode: string,
) {
  const params = new URLSearchParams({
    place_id: placeId,
    key: getApiKey(),
    language: languageCode,
    fields: "formatted_address,name,geometry/location",
  });
  if (sessionToken) {
    params.set("sessiontoken", sessionToken);
  }

  const res = await fetch(`${LEGACY_PLACES_BASE_URL}/details/json?${params.toString()}`);

  if (!res.ok) {
    await buildError(
      res,
      `Google Places details (legacy) failed (HTTP ${res.status}).`,
    );
  }

  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    result?: {
      formatted_address?: string;
      name?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
    };
  };

  if (data.status && data.status !== "OK") {
    throw new PlacesApiError(
      data.error_message ?? `Google Places details (legacy) failed (${data.status}).`,
      400,
      data,
    );
  }

  return {
    formattedAddress: data.result?.formatted_address,
    name: data.result?.name,
    lat: data.result?.geometry?.location?.lat,
    lng: data.result?.geometry?.location?.lng,
  } satisfies RestPlaceDetails;
}

export async function fetchAutocomplete(
  input: string,
  sessionToken?: string,
  country = "VN",
  languageCode = "vi"
): Promise<RestPrediction[]> {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  try {
    return await callNewAutocomplete(trimmed, sessionToken, country, languageCode);
  } catch (error) {
    if (shouldFallbackToLegacy(error)) {
      return callLegacyAutocomplete(trimmed, sessionToken, country, languageCode);
    }
    throw error;
  }
}

export async function fetchPlaceDetails(
  placeId: string,
  sessionToken?: string,
  languageCode = "vi"
): Promise<RestPlaceDetails> {
  try {
    return await callNewDetails(placeId, sessionToken, languageCode);
  } catch (error) {
    if (shouldFallbackToLegacy(error)) {
      return callLegacyDetails(placeId, sessionToken, languageCode);
    }
    throw error;
  }
}
