import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { BookingStatus, Prisma, TripType } from '@prisma/client';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { normalizeQuoteIdentifier } from '../../common/validation/is-uuid-or-cuid.decorator';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateBookingResponseDto } from './dto/create-booking.res.dto';
import { BookingListItemDto } from './dto/booking-list-item.dto';
import {
  BaseListBookingsQueryDto,
  ExportBookingsQueryDto,
  ListBookingsQueryDto,
} from './dto/list-bookings.query.dto';
import { ListBookingsResponseDto } from './dto/list-bookings.res.dto';

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

type BookingWithVehicle = Prisma.BookingGetPayload<{
  include: { VehicleType: { select: { name: true } } };
}>;

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

  async list(query: ListBookingsQueryDto): Promise<ListBookingsResponseDto> {
    const limit = query.limit ?? 50;
    const where = this.buildWhere(query);

    const bookings = await this.prisma.booking.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      include: {
        VehicleType: {
          select: { name: true },
        },
      },
    });

    const hasMore = bookings.length > limit;
    const pageItems = hasMore ? bookings.slice(0, limit) : bookings;

    return {
      items: pageItems.map((booking) => this.toListItem(booking)),
      hasMore,
      nextCursor: hasMore ? pageItems[pageItems.length - 1].id : undefined,
    };
  }

  async export(query: ExportBookingsQueryDto): Promise<{ filename: string; buffer: Buffer }> {
    const limit = query.limit ?? 500;
    const where = this.buildWhere(query);

    const bookings = await this.prisma.booking.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit,
      include: {
        VehicleType: {
          select: { name: true },
        },
      },
    });

    const xml = this.buildExcelXml(bookings);
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    const filename = `bookings-${timestamp}.xls`;
    return {
      filename,
      buffer: Buffer.from(xml, 'utf8'),
    };
  }

  private buildWhere(query: BaseListBookingsQueryDto): Prisma.BookingWhereInput {
    const where: Prisma.BookingWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDateFrom || query.startDateTo) {
      const range: Prisma.DateTimeFilter = {};
      if (query.startDateFrom) {
        const start = new Date(query.startDateFrom);
        if (!Number.isNaN(start.getTime())) {
          if (query.startDateFrom.length === 10) {
            start.setUTCHours(0, 0, 0, 0);
          }
          range.gte = start;
        }
      }
      if (query.startDateTo) {
        const end = new Date(query.startDateTo);
        if (!Number.isNaN(end.getTime())) {
          if (query.startDateTo.length === 10) {
            end.setUTCHours(23, 59, 59, 999);
          }
          range.lte = end;
        }
      }
      if (Object.keys(range).length > 0) {
        where.startAt = range;
      }
    }

    const search = query.search?.trim();
    if (search) {
      const phoneCandidate = search.replace(/[\s-]/g, '');
      const or: Prisma.BookingWhereInput[] = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { fromText: { contains: search, mode: 'insensitive' } },
        { toText: { contains: search, mode: 'insensitive' } },
        { id: search },
        { quoteId: search },
      ];
      if (phoneCandidate.length > 0) {
        or.push({ phone: { contains: phoneCandidate, mode: 'insensitive' } });
      }
      where.OR = or;
    }

    return where;
  }

  private toListItem(record: BookingWithVehicle): BookingListItemDto {
    return {
      id: record.id,
      quoteId: record.quoteId ?? null,
      customerName: record.customerName ?? null,
      phone: record.phone ?? null,
      totalVnd: record.totalVnd,
      createdAt: record.createdAt.toISOString(),
      startAt: record.startAt.toISOString(),
      status: record.status,
      tripType: record.tripType,
      vehicleTypeName: record.VehicleType?.name ?? null,
      fromText: record.fromText,
      toText: record.toText,
    };
  }

  private buildExcelXml(records: BookingWithVehicle[]): string {
    const headerTitles = [
      'STT',
      'Mã booking',
      'Thời gian đặt',
      'Thời gian khởi hành',
      'Khách hàng',
      'Số điện thoại',
      'Tuyến',
      'Loại chuyến',
      'Loại xe',
      'Trạng thái',
      'Tổng tiền (VND)',
      'Mã báo giá',
    ];

    const headerRow = `<Row>${headerTitles
      .map((title) => this.buildCell(title, 'String', 'sHeader'))
      .join('')}</Row>`;

    const dataRows = records
      .map((record, index) => {
        const route = `${record.fromText} → ${record.toText}`;
        return (
          '<Row>' +
          [
            this.buildCell(index + 1, 'Number'),
            this.buildCell(record.id),
            this.buildCell(record.createdAt.toISOString(), 'DateTime'),
            this.buildCell(record.startAt.toISOString(), 'DateTime'),
            this.buildCell(record.customerName ?? ''),
            this.buildCell(record.phone ?? ''),
            this.buildCell(route),
            this.buildCell(this.describeTripType(record.tripType)),
            this.buildCell(record.VehicleType?.name ?? ''),
            this.buildCell(this.describeStatus(record.status)),
            this.buildCell(record.totalVnd, 'Number', 'sCurrency'),
            this.buildCell(record.quoteId ?? ''),
          ].join('') +
          '</Row>'
        );
      })
      .join('');

    return [
      '<?xml version="1.0"?>',
      '<?mso-application progid="Excel.Sheet"?>',
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">',
      '<Styles>',
      '<Style ss:ID="sHeader"><Font ss:Bold="1"/><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/></Style>',
      '<Style ss:ID="sCurrency"><NumberFormat ss:Format="#,##0"/></Style>',
      '</Styles>',
      '<Worksheet ss:Name="Bookings">',
      '<Table>',
      headerRow,
      dataRows,
      '</Table>',
      '</Worksheet>',
      '</Workbook>',
    ].join('');
  }

  private buildCell(
    value: string | number,
    type: 'String' | 'Number' | 'DateTime' = 'String',
    styleId?: string,
  ): string {
    const style = styleId ? ` ss:StyleID="${styleId}"` : '';
    const data =
      type === 'String' ? this.escapeXml(String(value)) : String(value);
    return `<Cell${style}><Data ss:Type="${type}">${data}</Data></Cell>`;
  }

  private describeTripType(tripType: TripType): string {
    switch (tripType) {
      case 'AIRPORT':
        return 'Sân bay';
      case 'ROAD':
        return 'Đường dài';
      default:
        return tripType;
    }
  }

  private describeStatus(status: BookingStatus): string {
    switch (status) {
      case 'CONFIRMED':
        return 'Đã xác nhận';
      case 'CANCELED':
        return 'Đã hủy';
      case 'EXPIRED':
        return 'Hết hạn';
      default:
        return 'Đang xử lý';
    }
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .replace(/\r\n?/g, '\n')
      .replace(/\n/g, '&#10;');
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
