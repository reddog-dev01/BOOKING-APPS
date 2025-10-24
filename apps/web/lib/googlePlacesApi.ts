const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const PLACE_DETAILS_BASE_URL = "https://places.googleapis.com/v1/places";

export type PlaceSuggestion = {
  placeId: string;
  mainText: string;
  secondaryText?: string;
  description: string;
};

type AutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      structuredFormat?: {
        mainText?: { text?: string } | null;
        secondaryText?: { text?: string } | null;
      } | null;
      text?: { text?: string } | null;
    } | null;
  }>;
};

type PlaceDetailsResponse = {
  formattedAddress?: string;
  displayName?: { text?: string } | null;
  location?: { latitude?: number; longitude?: number } | null;
};

function buildSessionToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export function createSessionToken(): string {
  return buildSessionToken();
}

class PlacesApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "PlacesApiError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let reason = response.statusText;
    try {
      const data = (await response.json()) as { error?: { message?: string } };
      if (data?.error?.message) {
        reason = data.error.message;
      }
    } catch {
      // ignore json parse errors
    }
    throw new PlacesApiError(reason, response.status);
  }
  return (await response.json()) as T;
}

export async function fetchAutocompleteSuggestions(
  input: string,
  sessionToken?: string,
  languageCode = "vi",
  includedRegionCodes: string[] = ["VN"]
): Promise<PlaceSuggestion[]> {
  if (!API_KEY) {
    throw new PlacesApiError("Thiếu cấu hình NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
  }

  const response = await fetch(AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "placePrediction",
    },
    body: JSON.stringify({
      input,
      languageCode,
      sessionToken,
      includedRegionCodes,
    }),
  });

  const data = await handleResponse<AutocompleteResponse>(response);

  return (
    data.suggestions?.
      map((suggestion) => suggestion?.placePrediction ?? null)
      .filter((prediction): prediction is NonNullable<typeof prediction> => Boolean(prediction?.placeId))
      .map((prediction) => {
        const description = prediction.text?.text ?? "";
        const main = prediction.structuredFormat?.mainText?.text ?? description;
        const secondary = prediction.structuredFormat?.secondaryText?.text;
        return {
          placeId: prediction.placeId!,
          mainText: main,
          secondaryText: secondary || undefined,
          description: description || main,
        } satisfies PlaceSuggestion;
      }) ?? []
  );
}

export async function fetchPlaceDetails(
  placeId: string,
  languageCode = "vi",
  regionCode = "VN",
  sessionToken?: string
): Promise<{ formattedAddress?: string; lat?: number; lng?: number; displayName?: string } | null> {
  if (!API_KEY) {
    throw new PlacesApiError("Thiếu cấu hình NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
  }

  const url = new URL(`${PLACE_DETAILS_BASE_URL}/${encodeURIComponent(placeId)}`);
  url.searchParams.set("languageCode", languageCode);
  url.searchParams.set("regionCode", regionCode);
  if (sessionToken) {
    url.searchParams.set("sessionToken", sessionToken);
  }

  const response = await fetch(url.toString(), {
    headers: {
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "formattedAddress,location,displayName",
    },
  });

  const data = await handleResponse<PlaceDetailsResponse>(response);

  const lat = data.location?.latitude;
  const lng = data.location?.longitude;

  return {
    formattedAddress: data.formattedAddress ?? data.displayName?.text,
    lat: typeof lat === "number" ? lat : undefined,
    lng: typeof lng === "number" ? lng : undefined,
    displayName: data.displayName?.text ?? undefined,
  };
}

export { PlacesApiError };
