/**
 * Google Places server helpers (v1 – Places API (New))
 * - Autocomplete: POST https://places.googleapis.com/v1/places:autocomplete
 * - Details:      GET  https://places.googleapis.com/v1/places/{placeId} (yêu cầu Field Mask)
 */

export class MissingApiKeyError extends Error {
  constructor() {
    super('PLACES_API_KEY missing');
  }
}

export class PlacesApiError extends Error {
  status: number;
  body?: string;

  constructor(status: number, body?: string) {
    super(`Google Places API error (status=${status})`);
    this.status = status;
    this.body = body;
  }
}

type AutocompleteParams = {
  input: string;
  languageCode?: string; // ví dụ 'vi'
  regionCode?: string; // ví dụ 'VN'
  sessionToken?: string;
};

const PLACES_ENDPOINT_AUTOCOMPLETE =
  'https://places.googleapis.com/v1/places:autocomplete';
const PLACES_ENDPOINT_DETAILS = (id: string) =>
  `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`;

/** Autocomplete (v1) – trả về mảng suggestions (chuẩn v1).
 *  Để tương thích code cũ trả 'predictions', hàm sẽ fallback:
 *  suggestions ?? predictions ?? []
 */
export async function fetchAutocomplete(
  params: AutocompleteParams,
  _referer?: string // giữ tham số để tương thích signature cũ
) {
  const API_KEY = process.env.PLACES_API_KEY;
  if (!API_KEY) throw new MissingApiKeyError();

  const payload: Record<string, any> = {
    input: params.input,
    languageCode: params.languageCode || 'vi',
  };
  if (params.regionCode) payload.regionCode = params.regionCode;
  if (params.sessionToken) payload.sessionToken = params.sessionToken;

  const res = await fetch(PLACES_ENDPOINT_AUTOCOMPLETE, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();

  if (!res.ok) {
    // Trả đúng lỗi thật (không gom về "Billing")
    throw new PlacesApiError(res.status, text.slice(0, 2000));
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }

  // v1: data.suggestions; legacy: data.predictions
  return data.suggestions ?? data.predictions ?? [];
}

/** (Tuỳ chọn) Place Details (v1) – Field Mask BẮT BUỘC.
 *  Ví dụ dùng 'id,displayName,formattedAddress,location'.
 */
export async function fetchPlaceDetails(placeId: string, fieldMask: string) {
  const API_KEY = process.env.PLACES_API_KEY;
  if (!API_KEY) throw new MissingApiKeyError();

  const res = await fetch(PLACES_ENDPOINT_DETAILS(placeId), {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': fieldMask,
    },
  });

  const text = await res.text();
  if (!res.ok) throw new PlacesApiError(res.status, text.slice(0, 2000));
  return JSON.parse(text);
}
