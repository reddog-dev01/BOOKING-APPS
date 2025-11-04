import { HttpStatus } from '@nestjs/common';

import { GoogleMapsService } from '../../infra/maps/maps.service';
import { PricingService } from './pricing.service';

describe('PricingService driving distance resolution', () => {
  const prismaMock = {} as unknown as ConstructorParameters<typeof PricingService>[0];
  const sampleFrom = { lat: 21.214, lng: 105.806 };
  const sampleTo = { lat: 21.033, lng: 105.851 };

  const createService = (mapsImpl: Partial<GoogleMapsService>) =>
    new PricingService(prismaMock, mapsImpl as GoogleMapsService);

  it('normalizes positive distances from the maps provider', async () => {
    const maps = {
      directions: jest.fn().mockResolvedValue({
        meters: 15236,
        km: 15.236,
        provider: 'google' as const,
        raw: { status: 'OK' },
      }),
    } satisfies Partial<GoogleMapsService>;

    const service = createService(maps);
    const result = await service['getDrivingDistance'](sampleFrom, sampleTo);

    expect(result).toEqual({ km: 15.24, provider: 'google' });
    expect(maps.directions).toHaveBeenCalledWith(sampleFrom, sampleTo);
  });

  it('falls back to a great-circle estimate when providers return zero distance', async () => {
    const maps = {
      directions: jest.fn().mockResolvedValue({
        meters: 0,
        km: 0,
        provider: 'google' as const,
        raw: { status: 'ZERO_RESULTS' },
      }),
    } satisfies Partial<GoogleMapsService>;

    const service = createService(maps);
    const result = await service['getDrivingDistance'](sampleFrom, sampleTo);

    expect(result.provider).toBe('approximate');
    expect(result.km).toBe(25.83);
  });

  it('falls back to a great-circle estimate when providers throw', async () => {
    const providerError = new Error('upstream timeout');
    const maps = {
      directions: jest.fn().mockRejectedValue(providerError),
    } satisfies Partial<GoogleMapsService>;

    const service = createService(maps);
    const result = await service['getDrivingDistance'](sampleFrom, sampleTo);

    expect(result.provider).toBe('approximate');
    expect(result.km).toBe(25.83);
  });

  it('normalizes decimal-like coordinates before delegating to providers', async () => {
    const decimalLike = (value: string) => ({
      valueOf: () => value,
      toString: () => value,
    });
    const maps = {
      directions: jest.fn().mockRejectedValue(new Error('provider down')),
    } satisfies Partial<GoogleMapsService>;

    const service = createService(maps);
    const from = { lat: decimalLike('21.0101303'), lng: decimalLike('105.8153282') };
    const to = { lat: decimalLike('21.214184'), lng: decimalLike('105.802971') };

    const result = await service['getDrivingDistance'](from, to);

    expect(maps.directions).toHaveBeenCalledWith(
      { lat: 21.0101303, lng: 105.8153282 },
      { lat: 21.214184, lng: 105.802971 },
    );
    expect(result.provider).toBe('approximate');
    expect(result.km).toBe(28.41);
  });
});
