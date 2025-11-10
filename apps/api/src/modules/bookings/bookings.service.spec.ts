import 'reflect-metadata';

import { HttpStatus } from '@nestjs/common';

import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';

const quoteRecord = {
  id: 'c1234567890abcdef1234567a',
  tripType: 'AIRPORT',
  routeId: null,
  airportId: 'HAN',
  vehicleTypeId: 1,
  basePriceVnd: 100_000,
  distanceKm: 25,
  vatPct: 10,
  vatAmountVnd: 10_000,
  totalVnd: 110_000,
  expiresAt: new Date(Date.now() + 60_000),
  meta: {
    request: {
      fromText: 'Noi Bai',
      toText: 'Hoan Kiem',
      roundTrip: false,
    },
  },
};

const bookingRecord = {
  id: 'ckbooking1234567890abcdef',
};

function createService(overrides?: {
  findUnique?: jest.Mock;
  create?: jest.Mock;
}) {
  const findUnique = overrides?.findUnique ?? jest.fn().mockResolvedValue(quoteRecord);
  const create = overrides?.create ?? jest.fn().mockResolvedValue(bookingRecord);

  const prismaMock = {
    quote: { findUnique },
    booking: { create },
  } as unknown;

  return {
    service: new BookingsService(prismaMock as any),
    findUnique,
    create,
  };
}

describe('BookingsService', () => {
  it('normalizes incoming quote identifiers before fetching the quote', async () => {
    const { service, findUnique, create } = createService();

    const dto = {
      quoteId: ' C1234567890ABCDEF1234567A ',
      customerName: 'Nguyen Van A',
      customerPhone: '0123456789',
      fromText: 'Noi Bai',
      toText: 'Hoan Kiem',
    } as unknown as CreateBookingDto;

    const response = await service.create(dto);

    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'c1234567890abcdef1234567a' } });
    expect(create).toHaveBeenCalled();
    expect(response).toEqual({ bookingId: bookingRecord.id, status: 'PENDING' });
    expect(dto.quoteId).toBe('c1234567890abcdef1234567a');
  });

  it('fails fast when the quote identifier cannot be normalized', async () => {
    const { service, findUnique, create } = createService();

    const dto = {
      quoteId: 'invalid',
      customerName: 'Nguyen Van A',
      customerPhone: '0123456789',
      fromText: 'Noi Bai',
      toText: 'Hoan Kiem',
    } as unknown as CreateBookingDto;

    await expect(service.create(dto)).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: {
        error: 'QUOTE_ID_INVALID',
        message: 'quoteId must be a UUID v4 or Prisma CUID',
      },
    });

    expect(findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
