export interface ClientOptions {
  fetchImplementation?: typeof fetch;
}

export interface PlaceAutocompleteParams {
  input: string;
  key: string;
  language?: string;
  sessiontoken?: string;
  components?: string;
}

export interface PlaceDetailsParams {
  place_id: string;
  key: string;
  language?: string;
  sessiontoken?: string;
  fields?: string | string[];
  fieldMask?: string | string[];
}

export interface ClientRequest<TParams> {
  params: TParams;
  timeout?: number;
}

export interface ClientResponse<T = unknown> {
  data: T;
  raw?: string;
  status: number;
  headers: Record<string, string>;
  request: {
    url: string;
    method: string;
    body?: unknown;
  };
}

export class RequestError extends Error {
  response?: {
    status?: number;
    data?: unknown;
    raw?: string;
    headers?: Record<string, string>;
  };
  request?: {
    url: string;
    method: string;
    body?: unknown;
  };
}

export class Client {
  constructor(options?: ClientOptions);
  placeAutocomplete<T = unknown>(
    request: ClientRequest<PlaceAutocompleteParams>,
  ): Promise<ClientResponse<T>>;
  placeDetails<T = unknown>(
    request: ClientRequest<PlaceDetailsParams>,
  ): Promise<ClientResponse<T>>;
}
