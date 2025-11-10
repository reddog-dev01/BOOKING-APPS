import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateBookingDto } from './create-booking.dto';

describe('CreateBookingDto', () => {
  const basePayload = {
    customerName: 'Nguyen Van A',
    customerPhone: '0123456789',
    fromText: 'Noi Bai',
    toText: 'Hoan Kiem',
  };

  it('accepts Prisma cuid identifiers for quoteId', async () => {
    const dto = plainToInstance(CreateBookingDto, {
      ...basePayload,
      quoteId: 'c1234567890abcdef1234567a',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts UUID v4 identifiers for quoteId', async () => {
    const dto = plainToInstance(CreateBookingDto, {
      ...basePayload,
      quoteId: '550e8400-e29b-41d4-a716-446655440000',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects unsupported identifier formats', async () => {
    const dto = plainToInstance(CreateBookingDto, {
      ...basePayload,
      quoteId: 'not-valid',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isUuidOrCuid).toBe('quoteId must be a UUID v4 or Prisma CUID');
  });
});
