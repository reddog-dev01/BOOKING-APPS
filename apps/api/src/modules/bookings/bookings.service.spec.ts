import 'reflect-metadata';

import { HttpStatus } from '@nestjs/common';

import { plainToInstance } from 'class-transformer';

import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ExportBookingsQueryDto, ListBookingsQueryDto } from './dto/list-bookings.query.dto';

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

const BookingStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELED: 'CANCELED',
  EXPIRED: 'EXPIRED',
} as const;

const TripType = {
  AIRPORT: 'AIRPORT',
  ROAD: 'ROAD',
} as const;

function buildBookingRecord(overrides: Record<string, unknown> = {}) {
  const base = {
    id: 'ckbookingrow1234567890',
    quoteId: 'cquote1234567890',
    customerName: 'Nguyễn Văn A',
    phone: '0987654321',
    totalVnd: 150_000,
    createdAt: new Date('2025-01-01T10:00:00Z'),
    startAt: new Date('2025-01-02T08:00:00Z'),
    status: BookingStatus.PENDING,
    tripType: TripType.AIRPORT,
    vehicleTypeId: 2,
    VehicleType: { name: 'SUV 7 chỗ' },
    routeId: null,
    airportId: 'HAN',
    direction: null,
    isRoundTrip: false,
    pax: null,
    fromText: 'Nội Bài',
    toText: 'Hoàn Kiếm',
    fromLat: null,
    fromLng: null,
    toLat: null,
    toLng: null,
    stopsJson: null,
    distanceKm: 30,
    priceDistanceVnd: 120_000,
    waitMinutes: 0,
    priceWaitingVnd: 0,
    vatPct: 10,
    couponCode: null,
    subtotalVnd: 120_000,
    discountVnd: 0,
    vatVnd: 12_000,
    customerNote: null,
    updatedAt: new Date('2025-01-01T10:00:00Z'),
  };

  return { ...base, ...overrides } as unknown as Record<string, unknown>;
}

function createService(overrides?: {
  findUnique?: jest.Mock;
  create?: jest.Mock;
  findMany?: jest.Mock;
}) {
  const findUnique = overrides?.findUnique ?? jest.fn().mockResolvedValue(quoteRecord);
  const create = overrides?.create ?? jest.fn().mockResolvedValue(bookingRecord);
  const findMany = overrides?.findMany ?? jest.fn().mockResolvedValue([]);

  const prismaMock = {
    quote: { findUnique },
    booking: { create, findMany },
  } as unknown;

  return {
    service: new BookingsService(prismaMock as any),
    findUnique,
    create,
    findMany,
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

  it('returns booking list with pagination metadata and sanitized search filters', async () => {
    const rowA = buildBookingRecord({ id: 'bookingA', createdAt: new Date('2025-01-02T10:00:00Z') });
    const rowB = buildBookingRecord({ id: 'bookingB', createdAt: new Date('2025-01-02T09:00:00Z') });
    const { service, findMany } = createService({
      findMany: jest.fn().mockResolvedValue([rowA, rowB]),
    });

    const query = plainToInstance(ListBookingsQueryDto, {
      search: '0987 654 321',
      limit: '1',
    });

    const result = await service.list(query);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              phone: expect.objectContaining({ contains: '0987654321' }),
            }),
          ]),
        }),
        take: 2,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe('bookingA');
    expect(result.items[0]).toMatchObject({
      id: 'bookingA',
      vehicleTypeName: 'SUV 7 chỗ',
    });
  });

  it('exports bookings to Excel XML with localized headers', async () => {
    const row = buildBookingRecord({
      status: BookingStatus.CONFIRMED,
      tripType: TripType.ROAD,
      VehicleType: { name: 'Limousine' },
    });
    const { service, findMany } = createService({
      findMany: jest.fn().mockResolvedValue([row]),
    });

    const query = plainToInstance(ExportBookingsQueryDto, {
      status: BookingStatus.CONFIRMED,
      limit: '10',
    });

    const result = await service.export(query);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: BookingStatus.CONFIRMED }),
        take: 10,
      }),
    );

    const xml = result.buffer.toString('utf8');
    expect(xml).toContain('<?xml version="1.0"?>');
    expect(xml).toContain('Limousine');
    expect(xml).toContain('Đã xác nhận');
    expect(result.filename).toMatch(/^bookings-\d{8}T\d{6}\.xls$/);
  });
});
