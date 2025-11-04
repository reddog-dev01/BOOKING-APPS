import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AirportDirectionDto, QuoteRequestDto, TripTypeDto } from './quote-request.dto';

describe('QuoteRequestDto transformations', () => {
  const basePayload = {
    vehicleTypeId: 1,
    startAt: new Date().toISOString(),
    roundTrip: false,
    withVat: true,
  };

  it('ignores airport direction when provided as an empty string for ROAD trips', async () => {
    const payload = {
      ...basePayload,
      tripType: TripTypeDto.ROAD,
      routeCode: 'HN-QN',
      direction: '',
    } satisfies Record<string, unknown>;

    const dto = plainToInstance(QuoteRequestDto, payload);
    const result = await validate(dto);

    expect(result).toHaveLength(0);
    expect(dto.direction).toBeUndefined();
  });

  it('normalizes airport direction casing for AIRPORT trips', async () => {
    const payload = {
      ...basePayload,
      tripType: TripTypeDto.AIRPORT,
      airportCode: 'han',
      direction: 'in',
    } satisfies Record<string, unknown>;

    const dto = plainToInstance(QuoteRequestDto, payload);
    const result = await validate(dto);

    expect(result).toHaveLength(0);
    expect(dto.airportCode).toBe('HAN');
    expect(dto.direction).toBe(AirportDirectionDto.IN);
  });
});
