import { jest } from "@jest/globals";

describe("googlePlacesRest circuit breaker", () => {
  const advanceTo = (iso: string) => {
    jest.setSystemTime(new Date(iso));
  };

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    advanceTo("2025-01-01T00:00:00.000Z");
    process.env.PLACES_API_KEY = "test-key";
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (global as { fetch?: unknown }).fetch;
    delete process.env.PLACES_API_KEY;
  });

  const importModule = async () => {
    const module = await import("../lib/server/googlePlacesRest");
    return module;
  };

  const createFetchResponse = <T,>(status: number, body: T) => ({
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  });

  it("trips billing circuit and skips subsequent autocomplete fetches", async () => {
    const { fetchAutocomplete, resetPlacesCircuitBreakerForTests } = await importModule();

    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        createFetchResponse(403, {
          error: {
            message:
              "This API method requires billing to be enabled. Please enable billing on project then retry.",
          },
        }),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      fetchAutocomplete({ input: "Ho Chi Minh" }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("Google Places yêu cầu bật Billing"),
      status: 503,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(
      fetchAutocomplete({ input: "Ho Chi Minh" }),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    advanceTo("2025-01-01T00:11:00.000Z");

    fetchMock.mockResolvedValueOnce(createFetchResponse(200, { suggestions: [] }));

    await expect(
      fetchAutocomplete({ input: "Ho" }),
    ).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    resetPlacesCircuitBreakerForTests();
  });

  it("short-circuits place details when circuit is open", async () => {
    const { fetchAutocomplete, fetchPlaceDetails, resetPlacesCircuitBreakerForTests } =
      await importModule();

    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        createFetchResponse(403, {
          error: {
            message:
              "This API method requires billing to be enabled. Please enable billing on project then retry.",
          },
        }),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchAutocomplete({ input: "Ha Noi" })).rejects.toMatchObject({
      status: 503,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockClear();

    await expect(
      fetchPlaceDetails({ placeId: "abc" }),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();

    resetPlacesCircuitBreakerForTests();
  });
});
