import { GoogleMapsService } from './maps.service';

describe('GoogleMapsService.directions', () => {
  const sampleFrom = { lat: 21.003, lng: 105.820 };
  const sampleTo = { lat: 21.034, lng: 105.850 };
  const originalKey = process.env.PLACES_API_KEY;

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.PLACES_API_KEY = originalKey;
  });

  it('returns the first successful provider result', async () => {
    process.env.PLACES_API_KEY = 'dummy';
    const service = new GoogleMapsService();

    const googleSpy = jest
      .spyOn(service as unknown as Record<string, unknown>, 'lookupGoogleDirections')
      .mockResolvedValue({ meters: 12500, km: 12.5, provider: 'google' as const, raw: {} });
    const osrmSpy = jest
      .spyOn(service as unknown as Record<string, unknown>, 'lookupOsrmRoute')
      .mockResolvedValue({ meters: 14500, km: 14.5, provider: 'osrm' as const, raw: {} });

    const result = await service.directions(sampleFrom, sampleTo);

    expect(result).toEqual({ meters: 12500, km: 12.5, provider: 'google', raw: {} });
    expect(googleSpy).toHaveBeenCalledTimes(1);
    expect(osrmSpy).not.toHaveBeenCalled();
  });

  it('falls back to OSRM when Google returns zero distance', async () => {
    process.env.PLACES_API_KEY = 'dummy';
    const service = new GoogleMapsService();

    jest
      .spyOn(service as unknown as Record<string, unknown>, 'lookupGoogleDirections')
      .mockResolvedValue({ meters: 0, km: 0, provider: 'google' as const, raw: {} });
    const osrmSpy = jest
      .spyOn(service as unknown as Record<string, unknown>, 'lookupOsrmRoute')
      .mockResolvedValue({ meters: 18900, km: 18.9, provider: 'osrm' as const, raw: {} });

    const result = await service.directions(sampleFrom, sampleTo);

    expect(result).toEqual({ meters: 18900, km: 18.9, provider: 'osrm', raw: {} });
    expect(osrmSpy).toHaveBeenCalledTimes(1);
  });

  it('throws when every provider fails', async () => {
    process.env.PLACES_API_KEY = undefined;
    const service = new GoogleMapsService();

    jest
      .spyOn(service as unknown as Record<string, unknown>, 'lookupOsrmRoute')
      .mockResolvedValue({ meters: 0, km: 0, provider: 'osrm' as const, raw: {} });

    await expect(service.directions(sampleFrom, sampleTo)).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'DRIVING_DISTANCE_UNAVAILABLE' }),
      status: 502,
    });
  });
});
