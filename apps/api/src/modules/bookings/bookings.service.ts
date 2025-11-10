import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { normalizeQuoteIdentifier } from '../../common/validation/is-uuid-or-cuid.decorator';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateBookingResponseDto } from './dto/create-booking.res.dto';

interface QuoteRecord {
  id: string;
  tripType: string;
  routeId: string | null;
  airportId: string | null;
  vehicleTypeId: number;
  basePriceVnd: number;
  distanceKm: number;
  vatPct: number;
  vatAmountVnd: number;
  totalVnd: number;
  expiresAt: Date;
  meta?: Prisma.JsonValue | null;
}

interface QuoteDelegateLike {
  findUnique(args: { where: { id: string } }): Promise<QuoteRecord | null>;
}

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBookingDto): Promise<CreateBookingResponseDto> {
    const normalizedQuoteId = normalizeQuoteIdentifier(dto.quoteId);
    if (!normalizedQuoteId) {
      this.throwError(
        HttpStatus.BAD_REQUEST,
        'QUOTE_ID_INVALID',
        'quoteId must be a UUID v4 or Prisma CUID',
        { quoteId: dto.quoteId },
      );
    }

    dto.quoteId = normalizedQuoteId;

    const quoteDelegate = this.getQuoteDelegate();
    const quote = await quoteDelegate.findUnique({ where: { id: normalizedQuoteId } });
    if (!quote) {
      this.throwError(HttpStatus.NOT_FOUND, 'QUOTE_NOT_FOUND', 'Quote not found', {
        quoteId: normalizedQuoteId,
      });
    }

    if (quote.expiresAt.getTime() <= Date.now()) {
      this.throwError(HttpStatus.BAD_REQUEST, 'QUOTE_EXPIRED', 'Quote has expired', {
        quoteId: normalizedQuoteId,
      });
    }

    const meta = (quote.meta ?? {}) as Prisma.JsonObject;
    const requestMeta = (meta.request as Record<string, unknown> | undefined) ?? {};

    const fromText = dto.fromText ?? this.asString(requestMeta.fromText);
    const toText = dto.toText ?? this.asString(requestMeta.toText);
    if (!fromText || !toText) {
      this.throwError(
        HttpStatus.BAD_REQUEST,
        'LOCATION_REQUIRED',
        'fromText and toText are required',
      );
    }

    const fromLat = dto.fromLat ?? this.asNumber(requestMeta.fromLat);
    const fromLng = dto.fromLng ?? this.asNumber(requestMeta.fromLng);
    const toLat = dto.toLat ?? this.asNumber(requestMeta.toLat);
    const toLng = dto.toLng ?? this.asNumber(requestMeta.toLng);
    const stops = dto.stops ?? this.asStringArray(requestMeta.stops);

    const startAtIso = this.asString(requestMeta.startAt);
    const startAt = startAtIso ? new Date(startAtIso) : new Date();
    if (Number.isNaN(startAt.getTime())) {
      this.throwError(
        HttpStatus.BAD_REQUEST,
        'INVALID_START_AT',
        'startAt must be a valid ISO8601 string',
      );
    }

    const waitHours = this.asNumber(requestMeta.waitHours);
    const waitMinutes = waitHours ? Math.max(0, Math.round(waitHours * 60)) : 0;

    const couponCode = this.normalizeCoupon(
      dto.couponCode ?? this.asString(requestMeta.couponCode),
    );
    const direction = this.asString(requestMeta.direction);
    const resolvedDistance =
      dto.distanceKm ??
      this.asNumber(requestMeta.distanceKmOverride) ??
      quote.distanceKm ??
      0;

    const data = {
      tripType: quote.tripType,
      routeId: quote.routeId ?? null,
      airportId: quote.airportId ?? null,
      direction: direction ?? null,
      vehicleTypeId: quote.vehicleTypeId,
      fromText,
      toText,
      fromLat: fromLat ?? null,
      fromLng: fromLng ?? null,
      toLat: toLat ?? null,
      toLng: toLng ?? null,
      distanceKm: resolvedDistance,
      isRoundTrip: this.asBoolean(requestMeta.roundTrip) ?? false,
      waitMinutes,
      priceDistanceVnd: quote.basePriceVnd,
      priceWaitingVnd: 0,
      subtotalVnd: quote.basePriceVnd,
      discountVnd: 0,
      vatPct: quote.vatPct,
      vatVnd: quote.vatAmountVnd,
      totalVnd: quote.totalVnd,
      couponCode: couponCode ?? null,
      stopsJson:
        stops && stops.length > 0
          ? (stops as unknown as Prisma.InputJsonValue)
          : undefined,
      customerName: dto.customerName,
      phone: dto.customerPhone,
      customerNote: dto.customerNote ?? null,
      startAt,
      quoteId: quote.id,
    };

    const booking = await this.prisma.booking.create({
      data: data as unknown as Prisma.BookingUncheckedCreateInput,
      select: { id: true },
    });

    return {
      bookingId: booking.id,
      status: 'PENDING',
    };
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private asNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private asStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }
    const items = value.filter((item): item is string => typeof item === 'string' && item.length > 0);
    return items.length > 0 ? items : undefined;
  }

  private normalizeCoupon(value: string | undefined): string | null {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private getQuoteDelegate(): QuoteDelegateLike {
    const delegate = (
      this.prisma as unknown as Record<string, unknown>
    ).quote as QuoteDelegateLike | undefined;
    if (!delegate || typeof delegate.findUnique !== 'function') {
      this.throwError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'MISSING_SCHEMA_FIELD',
        'Quote model is not available in Prisma client',
      );
    }
    return delegate;
  }

  private asBoolean(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined;
  }

  private throwError(
    status: HttpStatus,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ): never {
    throw new HttpException({ error: code, message, details }, status);
  }
}
