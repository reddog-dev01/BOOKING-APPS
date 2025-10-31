const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL = (placeId) =>
  `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
const DEFAULT_LANGUAGE = "vi";
const DEFAULT_FIELD_MASK = "id,displayName,formattedAddress,location";

const toHeaderRecord = (headers) => {
  const record = {};
  if (!headers || typeof headers.forEach !== "function") {
    return record;
  }
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
};

const normalizeFieldMask = (fields) => {
  if (Array.isArray(fields)) {
    return fields.join(",");
  }
  if (typeof fields === "string" && fields.trim().length > 0) {
    return fields.trim();
  }
  return DEFAULT_FIELD_MASK;
};

const parseCountryFromComponents = (components) => {
  if (typeof components !== "string") {
    return undefined;
  }
  const match = components.match(/country:([A-Za-z]{2})/i);
  return match ? match[1].toUpperCase() : undefined;
};

const readResponse = async (response) => {
  const raw = await response.text();
  let parsed;
  try {
    parsed = raw ? JSON.parse(raw) : undefined;
  } catch {
    parsed = raw || undefined;
  }
  return { raw, parsed };
};

class RequestError extends Error {
  constructor(message, options) {
    super(message);
    this.name = "RequestError";
    this.response = options?.response;
    this.request = options?.request;
  }
}

class Client {
  constructor(options = {}) {
    const fetchImpl = options.fetchImplementation ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new Error("A fetch implementation is required");
    }
    this.fetch = fetchImpl;
  }

  async placeAutocomplete(request) {
    const params = request?.params ?? {};
    if (!params.key) {
      throw new Error("placeAutocomplete requires a key param");
    }
    if (!params.input) {
      throw new Error("placeAutocomplete requires an input param");
    }

    const payload = {
      input: params.input,
      languageCode: params.language ?? DEFAULT_LANGUAGE,
    };

    if (params.sessiontoken) {
      payload.sessionToken = params.sessiontoken;
    }

    const country = parseCountryFromComponents(params.components);
    if (country) {
      payload.regionCode = country;
    }

    return this.#execute({
      url: AUTOCOMPLETE_URL,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": params.key,
      },
      body: JSON.stringify(payload),
    });
  }

  async placeDetails(request) {
    const params = request?.params ?? {};
    if (!params.key) {
      throw new Error("placeDetails requires a key param");
    }
    if (!params.place_id) {
      throw new Error("placeDetails requires a place_id param");
    }

    const url = new URL(DETAILS_URL(params.place_id));
    if (params.sessiontoken) {
      url.searchParams.set("sessionToken", params.sessiontoken);
    }
    if (params.language) {
      url.searchParams.set("languageCode", params.language);
    }

    const fieldMask = normalizeFieldMask(params.fields ?? params.fieldMask);

    return this.#execute({
      url: url.toString(),
      method: "GET",
      headers: {
        "X-Goog-Api-Key": params.key,
        "X-Goog-FieldMask": fieldMask,
      },
    });
  }

  async #execute(options) {
    const response = await this.fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
    });

    const { raw, parsed } = await readResponse(response);
    const headers = toHeaderRecord(response.headers);

    if (!response.ok) {
      throw new RequestError(`Google Maps API error (status=${response.status})`, {
        response: {
          status: response.status,
          data: parsed,
          raw,
          headers,
        },
        request: {
          url: options.url,
          method: options.method,
          body: options.body,
        },
      });
    }

    return {
      data: parsed,
      raw,
      status: response.status,
      headers,
      request: {
        url: options.url,
        method: options.method,
        body: options.body,
      },
    };
  }
}

export { Client, RequestError };
