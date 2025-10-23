import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { GoogleMapsService } from '../../infra/maps/maps.service';
import { PricingService } from '../pricing/pricing.service';
import { CreateBookingDto, TripTypeDto } from './dto/create-booking.dto';
import { BookingStatus, TripType } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private maps: GoogleMapsService,
    private pricing: PricingService,
  ) {}

  private normalizePhone(phone: string) {
    return (phone ?? '')
      .replace(/\s+/g, '')
      .replace(/^(?:\+?84)(\d+)/, '0$1');
  }

  private async resolveRefs(dto: CreateBookingDto) {
    let routeId: string | null = null; let airportId: string | null = null;
    if (dto.tripType === TripTypeDto.ROAD) {
      if (!dto.routeCode) throw new BadRequestException('routeCode required for ROAD');
      const r = await this.prisma.route.findUnique({ where: { code: dto.routeCode } });
      if (!r || !r.isActive) throw new NotFoundException('Route not found');
      routeId = r.id;
    } else {
      if (!dto.airportCode) throw new BadRequestException('airportCode required for AIRPORT');
      if (!dto.direction) throw new BadRequestException('direction required for AIRPORT');
      const a = await this.prisma.airport.findUnique({ where: { code: dto.airportCode } });
      if (!a || !a.isActive) throw new NotFoundException('Airport not found');
      airportId = a.id;
    }
    const v = await this.prisma.vehicleType.findUnique({ where: { id: dto.vehicleTypeId } });
    if (!v || !v.isActive) throw new NotFoundException('Vehicle type not available');
    return { routeId, airportId, vehicle: v };
  }

  async create(dto: CreateBookingDto) {
    // Chuẩn hoá alias từ FE
    const fromText = dto.fromText ?? dto.fromLabel ?? '';
    const toText   = dto.toText   ?? dto.toLabel   ?? '';
    if (!fromText?.trim() || !toText?.trim()) throw new BadRequestException('from/to required');

    // Khoảng cách
    let distanceKm = dto.distanceKm;
    if ((!distanceKm || distanceKm <= 0) && dto.fromLat && dto.fromLng && dto.toLat && dto.toLng) {
      const d = await this.maps.directions({ lat: dto.fromLat, lng: dto.fromLng }, { lat: dto.toLat, lng: dto.toLng });
      distanceKm = Math.max(0, Math.round(d.km * 10) / 10);
    }

    // Quote ở server (không tin giá FE)
    const quote = await this.pricing.quote({
      tripType: dto.tripType as any,
      vehicleTypeId: dto.vehicleTypeId,
      fromText, toText,
      fromLat: dto.fromLat, fromLng: dto.fromLng, toLat: dto.toLat, toLng: dto.toLng,
      distanceKm,
      roundTrip: !!dto.roundTrip,
      // Ưu tiên withVat -> defaultVAT; fallback dto.vatPct nếu có
      withVat: dto.withVat,
      vatPct: dto.vatPct,
      couponCode: dto.couponCode,
      stops: dto.stops,
      direction: (dto as any).direction,
      waitHours: dto.waitHours,
      startAt: dto.startAt,
    } as any);

    const { routeId, airportId } = await this.resolveRefs(dto);
    const direction = dto.tripType === TripTypeDto.AIRPORT ? dto.direction ?? null : null;

    const waitMinutes = Math.max(0, Math.round(((dto.waitHours ?? 0) * 60)));
    const stops = Array.isArray(dto.stops)
      ? dto.stops.map((s) => s.trim()).filter(Boolean)
      : undefined;
    const normalizedPhone = this.normalizePhone(dto.phone);
    const customerName = dto.customerName?.trim();
    if (!customerName) throw new BadRequestException('customerName required');
    if (!/^0\d{9,10}$/.test(normalizedPhone)) {
      throw new BadRequestException('phone must start with 0 and contain 10-11 digits');
    }
    const couponCode = dto.couponCode?.trim();

    const rawDistanceKm = distanceKm ?? (quote as any).distanceKm ?? 0;
    const persistedDistanceKm = Number.isFinite(rawDistanceKm)
      ? Math.max(0, Number(rawDistanceKm))
      : 0;

    const created = await this.prisma.booking.create({
      data: {
        tripType: dto.tripType === TripTypeDto.AIRPORT ? TripType.AIRPORT : TripType.ROAD,
        routeId: routeId || undefined,
        airportId: airportId || undefined,
        vehicleTypeId: dto.vehicleTypeId,
        direction: direction || undefined,

        // DB chỉ có fromText/toText
        fromText, toText,
        fromLat: dto.fromLat, fromLng: dto.fromLng,
        toLat: dto.toLat, toLng: dto.toLng,
        distanceKm: persistedDistanceKm,
        isRoundTrip: !!dto.roundTrip,
        waitMinutes,

        // Thuế: lấy theo quote (ưu tiên) hoặc suy ra
        vatPct: (quote as any).vatPct ?? (dto.withVat ? (quote as any).defaultVatPct ?? 10 : (dto.vatPct ?? 0)),
        couponCode: couponCode || undefined,

        priceDistanceVnd: (quote as any).priceDistanceVnd ?? 0,
        priceWaitingVnd: (quote as any).priceWaitingVnd ?? 0,
        subtotalVnd: (quote as any).subtotalVnd ?? 0,
        discountVnd: (quote as any).discountVnd ?? 0,
        vatVnd: (quote as any).vatVnd ?? 0,
        totalVnd: (quote as any).totalVnd ?? 0,

        stopsJson: stops && stops.length ? JSON.stringify(stops) as any : undefined,

        customerName,
        phone: normalizedPhone,
        status: BookingStatus.PENDING,
        startAt: dto.startAt ? new Date(dto.startAt) : new Date(),
      },
      select: { id: true, status: true, totalVnd: true },
    });

    return { id: created.id, status: 'pending', totalVnd: created.totalVnd };
  }

  async get(id: string) {
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Not found');
    return b;
  }
}
