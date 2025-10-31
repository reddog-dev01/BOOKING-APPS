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
    delete process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (global as { fetch?: unknown }).fetch;
    delete process.env.PLACES_API_KEY;
    delete process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
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

  it("falls back to alternate env keys when PLACES_API_KEY is absent", async () => {
    delete process.env.PLACES_API_KEY;
    process.env.GOOGLE_PLACES_API_KEY = "fallback-key";

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchAutocomplete, resetPlacesCircuitBreakerForTests, resetPlacesKeyCacheForTests } =
      await importModule();

    const fetchMock = jest
      .fn()
      .mockResolvedValue(createFetchResponse(200, { suggestions: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchAutocomplete({ input: "Ho Chi Minh" })).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as { headers?: Record<string, string> } | undefined)?.headers ?? {};
    expect(headers).toMatchObject({ "X-Goog-Api-Key": "fallback-key" });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("\"msg\":\"places.fallback_env_used\""),
    );

    warnSpy.mockRestore();
    resetPlacesKeyCacheForTests();
    resetPlacesCircuitBreakerForTests();
  });

  it("trips billing circuit and skips subsequent autocomplete fetches", async () => {
    const { fetchAutocomplete, resetPlacesCircuitBreakerForTests, resetPlacesKeyCacheForTests } =
      await importModule();

    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        createFetchResponse(403, {
          error: {
            message: "PERMISSION_DENIED",
            details: [
              {
                "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                reason: "BILLING_DISABLED",
              },
            ],
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
    resetPlacesKeyCacheForTests();
  });

  it("short-circuits place details when circuit is open", async () => {
    const {
      fetchAutocomplete,
      fetchPlaceDetails,
      resetPlacesCircuitBreakerForTests,
      resetPlacesKeyCacheForTests,
    } = await importModule();

    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        createFetchResponse(403, {
          error: {
            message: "Forbidden",
            details: [
              {
                "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                reason: "BILLING_DISABLED",
              },
            ],
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
    resetPlacesKeyCacheForTests();
  });

  it("loads the Places key from configured env files when process env vars are empty", async () => {
    delete process.env.PLACES_API_KEY;

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const {
      fetchAutocomplete,
      resetPlacesCircuitBreakerForTests,
      resetPlacesKeyCacheForTests,
      setPlacesKeyFileResolverForTests,
    } = await importModule();

    setPlacesKeyFileResolverForTests(() => ({ key: "file-key", source: "apps/web/.env.local" }));

    const fetchMock = jest
      .fn()
      .mockResolvedValue(createFetchResponse(200, { suggestions: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchAutocomplete({ input: "Da Nang" })).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as { headers?: Record<string, string> } | undefined)?.headers ?? {};
    expect(headers).toMatchObject({ "X-Goog-Api-Key": "file-key" });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("\"msg\":\"places.env_file_fallback\""),
    );

    warnSpy.mockRestore();
    setPlacesKeyFileResolverForTests(null);
    resetPlacesKeyCacheForTests();
    resetPlacesCircuitBreakerForTests();
  });

  it("maps API key restriction reasons to a friendly message", async () => {
    const {
      fetchAutocomplete,
      resetPlacesCircuitBreakerForTests,
      resetPlacesKeyCacheForTests,
    } = await importModule();

    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        createFetchResponse(403, {
          error: {
            message: "Forbidden",
            details: [
              {
                "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                reason: "API_KEY_HTTP_REFERRER_BLOCKED",
              },
            ],
          },
        }),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchAutocomplete({ input: "Hue" })).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining("Google Places key đang bị hạn chế"),
    });

    resetPlacesCircuitBreakerForTests();
    resetPlacesKeyCacheForTests();
  });

  it("surfaces a MissingApiKeyError when env files and process vars do not contain a key", async () => {
    delete process.env.PLACES_API_KEY;
    delete process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const {
      fetchAutocomplete,
      resetPlacesCircuitBreakerForTests,
      resetPlacesKeyCacheForTests,
      setPlacesKeyFileResolverForTests,
      MissingApiKeyError,
    } = await importModule();

    setPlacesKeyFileResolverForTests(() => null);

    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchAutocomplete({ input: "Hue" })).rejects.toBeInstanceOf(MissingApiKeyError);
    expect(fetchMock).not.toHaveBeenCalled();

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("\"msg\":\"places.env_file_fallback\""),
    );

    warnSpy.mockRestore();
    setPlacesKeyFileResolverForTests(null);
    resetPlacesKeyCacheForTests();
    resetPlacesCircuitBreakerForTests();
  });
});

describe("googlePlacesRest API key resolution", () => {
  it("allows IP-restricted production keys", async () => {
    jest.resetModules();
    process.env.PLACES_API_KEY = "AIzaSyTestServerKey0000000000000000000000";

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const { fetchAutocomplete, resetPlacesCircuitBreakerForTests, resetPlacesKeyCacheForTests } =
      await import("../lib/server/googlePlacesRest");

    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ suggestions: [] }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchAutocomplete({ input: "Hue" })).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('"msg":"places.placeholder_key_detected"'),
    );

    warnSpy.mockRestore();
    resetPlacesKeyCacheForTests();
    resetPlacesCircuitBreakerForTests();
    delete process.env.PLACES_API_KEY;
    delete (global as { fetch?: unknown }).fetch;
  });
});

describe("googlePlacesRest env parsing", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("supports export syntax when reading env files", async () => {
    const module = await import("../lib/server/googlePlacesRest");
    expect(
      module.__testing_extractKeyFromEnvFile(`export   PLACES_API_KEY =  "abc123"`),
    ).toBe("abc123");
  });

  it("strips inline comments for unquoted values", async () => {
    const module = await import("../lib/server/googlePlacesRest");
    expect(
      module.__testing_extractKeyFromEnvFile(`PLACES_API_KEY=abc123 # comment here`),
    ).toBe("abc123");
  });
});
