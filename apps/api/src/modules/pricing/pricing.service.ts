import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Airport, Prisma, TripType } from '@prisma/client';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { QuoteRequestDto, TripTypeDto } from './dto/quote-request.dto';
import { QuoteResponseDto } from './dto/quote-response.dto';

const QUOTE_TTL_MS = 15 * 60 * 1000;
const KM_PER_HOUR_DEFAULT = 40;

type QuoteMeta = Prisma.JsonObject & {
  request: Record<string, unknown>;
  computed: Record<string, unknown>;
};

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async createQuote(dto: QuoteRequestDto): Promise<QuoteResponseDto> {
    const now = new Date();
    const vehicle = await this.prisma.vehicleType.findFirst({
      where: { id: dto.vehicleTypeId, isActive: true },
    });
    if (!vehicle) {
      this.throwError(HttpStatus.NOT_FOUND, 'VEHICLE_NOT_FOUND', 'Vehicle type not found', {
        vehicleTypeId: dto.vehicleTypeId,
      });
    }

    const siteSetting = await this.prisma.siteSetting.findFirst();
    const defaultVatPct = siteSetting?.defaultVatPct ?? 0;

    let basePrice = 0;
    let distanceKm = 0;
    let timeMinutes = 0;
    let routeId: string | undefined;
    let airport: Airport | null = null;

    if (dto.tripType === TripTypeDto.ROAD) {
      if (!dto.routeCode) {
        this.throwError(HttpStatus.BAD_REQUEST, 'ROUTE_REQUIRED', 'routeCode is required for ROAD trips');
      }
      const route = await this.prisma.route.findFirst({
        where: {
          code: dto.routeCode,
          tripType: TripType.ROAD,
          isActive: true,
        },
      });
      if (!route) {
        this.throwError(HttpStatus.NOT_FOUND, 'ROUTE_NOT_FOUND', 'Route not found', {
          routeCode: dto.routeCode,
        });
      }
      routeId = route.id;

      const policy = await this.prisma.pricePolicy.findFirst({
        where: {
          routeId: route.id,
          vehicleTypeId: dto.vehicleTypeId,
          effectiveFrom: { lte: now },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: now } },
          ],
        },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (!policy) {
        this.throwError(HttpStatus.NOT_FOUND, 'PRICE_POLICY_NOT_FOUND', 'Price policy not found', {
          routeCode: dto.routeCode,
          vehicleTypeId: dto.vehicleTypeId,
        });
      }

      basePrice = policy.basePriceVnd;
      if (dto.roundTrip && policy.roundTripPct > 0) {
        basePrice += Math.round((basePrice * policy.roundTripPct) / 100);
      }

      distanceKm = this.resolveRoadDistance(dto, route.distanceKm ?? 0);
      timeMinutes = this.estimateMinutes(distanceKm);
    } else {
      airport = await this.resolveAirport(dto.airportCode);
      distanceKm = this.resolveAirportDistance(dto, airport);
      basePrice = Math.max(0, Math.round(distanceKm * vehicle.perKmVnd));
      timeMinutes = this.estimateMinutes(distanceKm);
    }

    const vatPct = dto.withVat ? dto.vatPct ?? defaultVatPct : 0;
    const vatAmount = Math.round((basePrice * vatPct) / 100);
    const total = basePrice + vatAmount;
    const expiresAt = new Date(Date.now() + QUOTE_TTL_MS);

    const meta: QuoteMeta = {
      request: {
        tripType: dto.tripType,
        routeCode: dto.routeCode ?? null,
        airportCode: dto.airportCode ?? null,
        direction: dto.direction ?? null,
        startAt: dto.startAt,
        roundTrip: dto.roundTrip,
        withVat: dto.withVat,
        vatPct: dto.vatPct ?? null,
        couponCode: dto.couponCode ?? null,
        stops: dto.stops ?? [],
        fromText: dto.fromText ?? null,
        toText: dto.toText ?? null,
        fromLat: dto.fromLat ?? null,
        fromLng: dto.fromLng ?? null,
        toLat: dto.toLat ?? null,
        toLng: dto.toLng ?? null,
        distanceKmOverride: dto.distanceKm ?? null,
        waitHours: dto.waitHours ?? null,
      },
      computed: {
        basePrice,
        vatPct,
        distanceKm,
        timeMinutes,
        airportId: airport?.id ?? null,
        routeId: routeId ?? null,
      },
    };

    const created = await this.prisma.quote.create({
      data: {
        tripType: dto.tripType === TripTypeDto.AIRPORT ? TripType.AIRPORT : TripType.ROAD,
        routeId,
        airportId: airport?.id,
        vehicleTypeId: dto.vehicleTypeId,
        basePriceVnd: basePrice,
        distanceKm,
        timeMinutes,
        vatPct,
        vatAmountVnd: vatAmount,
        totalVnd: total,
        currency: 'VND',
        expiresAt,
        meta: meta as Prisma.JsonObject,
      },
    });

    return {
      id: created.id,
      vehicleTypeId: created.vehicleTypeId,
      basePrice: created.basePriceVnd,
      distanceKm: created.distanceKm,
      timeMinutes: created.timeMinutes,
      vatPct: created.vatPct,
      vatAmount: created.vatAmountVnd,
      total: created.totalVnd,
      currency: 'VND',
      expiresAt: created.expiresAt.toISOString(),
      meta,
    };
  }

  private resolveRoadDistance(dto: QuoteRequestDto, fallback: number): number {
    if (dto.distanceKm && dto.distanceKm > 0) {
      return dto.distanceKm;
    }
    if (fallback > 0) {
      return fallback;
    }
    return this.resolveDistanceFromCoordinates(dto);
  }

  private resolveAirportDistance(dto: QuoteRequestDto, airport: Airport): number {
    const distance = dto.distanceKm && dto.distanceKm > 0
      ? dto.distanceKm
      : this.resolveDistanceFromCoordinates(dto, airport);
    if (distance <= 0) {
      this.throwError(HttpStatus.BAD_REQUEST, 'INVALID_DISTANCE', 'Unable to resolve distance for airport trip');
    }
    return distance;
  }

  private async resolveAirport(code: string | undefined): Promise<Airport> {
    if (!code) {
      this.throwError(HttpStatus.BAD_REQUEST, 'AIRPORT_REQUIRED', 'airportCode is required for AIRPORT trips');
    }
    const airport = await this.prisma.airport.findFirst({ where: { code, isActive: true } });
    if (!airport) {
      this.throwError(HttpStatus.NOT_FOUND, 'AIRPORT_NOT_FOUND', 'Airport not found', { airportCode: code });
    }
    return airport;
  }

  private resolveDistanceFromCoordinates(dto: QuoteRequestDto, airport?: Airport | null): number {
    const points: Array<{ lat: number; lng: number }> = [];
    if (dto.fromLat != null && dto.fromLng != null) {
      points.push({ lat: dto.fromLat, lng: dto.fromLng });
    }
    if (dto.toLat != null && dto.toLng != null) {
      points.push({ lat: dto.toLat, lng: dto.toLng });
    }
    if (points.length === 2) {
      return this.haversine(points[0], points[1]);
    }
    if (points.length === 1 && airport) {
      return this.haversine(points[0], { lat: airport.lat, lng: airport.lng });
    }
    if (airport) {
      return 0;
    }
    return 0;
  }

  private haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const hav =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    const distance = 2 * 6371 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
    return Math.max(0, Math.round(distance * 100) / 100);
  }

  private estimateMinutes(distanceKm: number): number {
    if (distanceKm <= 0) {
      return 0;
    }
    return Math.max(1, Math.round((distanceKm / KM_PER_HOUR_DEFAULT) * 60));
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
