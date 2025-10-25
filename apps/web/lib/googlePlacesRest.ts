const PLACES_BASE_URL = "https://places.googleapis.com/v1";
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

function buildErrorMessage(res: Response, fallback: string) {
  return res
    .json()
    .catch(() => null)
    .then((body) => {
      if (body?.error?.message) {
        return body.error.message as string;
      }
      return fallback;
    });
}

export async function fetchAutocomplete(
  input: string,
  sessionToken?: string,
  country = "VN",
  languageCode = "vi"
): Promise<RestPrediction[]> {
  const apiKey = getApiKey();
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  const res = await fetch(`${PLACES_BASE_URL}/places:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK_AUTOCOMPLETE,
    },
    body: JSON.stringify({
      input: trimmed,
      languageCode,
      regionCode: country,
      components: { countries: [country] },
      sessionToken,
    }),
  });

  if (!res.ok) {
    throw new Error(
      await buildErrorMessage(
        res,
        `Google Places autocomplete failed (HTTP ${res.status}).`
      )
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

export async function fetchPlaceDetails(
  placeId: string,
  sessionToken?: string,
  languageCode = "vi"
): Promise<RestPlaceDetails> {
  const apiKey = getApiKey();
  const encoded = encodeURIComponent(placeId);
  const searchParams = new URLSearchParams({ languageCode });
  if (sessionToken) {
    searchParams.set("sessionToken", sessionToken);
  }

  const res = await fetch(`${PLACES_BASE_URL}/places/${encoded}?${searchParams}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK_DETAILS,
    },
  });

  if (!res.ok) {
    throw new Error(
      await buildErrorMessage(
        res,
        `Google Places details failed (HTTP ${res.status}).`
      )
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
  };
}
