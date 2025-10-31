/** @jest-environment node */

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import type { NextRequest } from "next/server";

jest.mock("../lib/server/googlePlacesRest", () => {
  const actual = jest.requireActual("../lib/server/googlePlacesRest");
  return {
    ...actual,
    fetchAutocomplete: jest.fn(),
    fetchPlaceDetails: jest.fn(),
  };
});

const createRequest = (
  body: unknown,
  options?: { headers?: Record<string, string>; ip?: string },
): NextRequest => {
  const headerEntries = Object.entries(options?.headers ?? {}).map(([key, value]) => [
    key.toLowerCase(),
    value,
  ]) as Array<[string, string]>;
  const headersMap = new Map<string, string>(headerEntries);

  return {
    json: async () => body,
    headers: {
      get: (key: string) => headersMap.get(key.toLowerCase()) ?? null,
    },
    ip: options?.ip,
  } as unknown as NextRequest;
};

describe("Places API routes propagate upstream statuses", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("prefers the Google payload status code for autocomplete errors", async () => {
    const placesModule = await import("../lib/server/googlePlacesRest");
    const { POST: autocompletePost } = await import(
      "../app/api/places/autocomplete/route"
    );

    const error = new placesModule.PlacesApiError("Billing disabled", 503, {
      error: {
        code: 403,
        message: "This API method requires billing to be enabled.",
      },
    });

    (placesModule.fetchAutocomplete as any).mockRejectedValueOnce(error);

    const response = await autocompletePost(
      createRequest(
        { input: "ha noi" },
        { headers: { "x-forwarded-for": "10.0.0.1" }, ip: "10.0.0.1" },
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { detail: { error: { code: 403 } } },
    });
  });

  it("falls back to the PlacesApiError status when payload lacks a code", async () => {
    const placesModule = await import("../lib/server/googlePlacesRest");
    const { POST: autocompletePost } = await import(
      "../app/api/places/autocomplete/route"
    );

    const error = new placesModule.PlacesApiError("Quota exceeded", 429);
    (placesModule.fetchAutocomplete as any).mockRejectedValueOnce(error);

    const response = await autocompletePost(
      createRequest(
        { input: "da nang" },
        { headers: { "x-forwarded-for": "10.0.0.2" }, ip: "10.0.0.2" },
      ),
    );

    expect(response.status).toBe(429);
  });

  it("prefers Google payload codes for place details errors", async () => {
    const placesModule = await import("../lib/server/googlePlacesRest");
    const { POST: detailsPost } = await import("../app/api/places/details/route");

    const error = new placesModule.PlacesApiError("Billing disabled", 503, {
      error: { code: 403 },
    });
    (placesModule.fetchPlaceDetails as any).mockRejectedValueOnce(error);

    const response = await detailsPost(
      createRequest(
        { placeId: "abc" },
        { headers: { "x-forwarded-for": "10.0.0.3" }, ip: "10.0.0.3" },
      ),
    );

    expect(response.status).toBe(403);
  });
});
