import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Airport, Prisma, TripType } from '@prisma/client';

import { GoogleMapsService } from '../../infra/maps/maps.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { QuoteRequestDto, TripTypeDto } from './dto/quote-request.dto';
import { QuoteResponseDto } from './dto/quote-response.dto';

interface QuoteCreateDelegate {
  create(args: { data: Record<string, unknown> }): Promise<QuoteRecord>;
}

interface QuoteRecord {
  id: string;
  vehicleTypeId: number;
  basePriceVnd: number;
  distanceKm: number;
  timeMinutes: number;
  vatPct: number;
  vatAmountVnd: number;
  totalVnd: number;
  currency: string;
  expiresAt: Date;
  meta?: Prisma.JsonValue | null;
}

const QUOTE_TTL_MS = 15 * 60 * 1000;
const KM_PER_HOUR_DEFAULT = 40;
const EARTH_RADIUS_KM = 6371;
// Allow ops to tune the approximation without code changes; default keeps error within ~25% of road distance.
const parsedFallbackMultiplier = Number(process.env.PRICING_FALLBACK_DISTANCE_MULTIPLIER);
const FALLBACK_DISTANCE_MULTIPLIER = Number.isFinite(parsedFallbackMultiplier) && parsedFallbackMultiplier >= 1
  ? parsedFallbackMultiplier
  : 1.25;

type DistanceProvider = 'request' | 'route' | 'google' | 'osrm' | 'approximate' | 'unknown';

type CoordinateInput = { lat: unknown; lng: unknown };
type NormalizedPoint = { lat: number; lng: number };

interface DistanceResolution {
  km: number;
  provider: DistanceProvider;
}

type QuoteMeta = Prisma.JsonObject & {
  request: Record<string, unknown>;
  computed: Record<string, unknown>;
};

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly maps: GoogleMapsService,
  ) {}

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
    let distance: DistanceResolution = { km: 0, provider: 'unknown' };
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
        this.throwError(
          HttpStatus.NOT_FOUND,
          'PRICE_POLICY_NOT_FOUND',
          'Price policy not found',
          {
            routeCode: dto.routeCode,
            vehicleTypeId: dto.vehicleTypeId,
          },
        );
      }

      basePrice = policy.basePriceVnd;
      if (dto.roundTrip && policy.roundTripPct > 0) {
        basePrice += Math.round((basePrice * policy.roundTripPct) / 100);
      }

      distance = await this.resolveRoadDistance(dto, route.distanceKm ?? 0);
      timeMinutes = this.estimateMinutes(distance.km);
    } else {
      airport = await this.resolveAirport(dto.airportCode);
      distance = await this.resolveAirportDistance(dto, airport);
      basePrice = Math.max(0, Math.round(distance.km * vehicle.perKmVnd));
      timeMinutes = this.estimateMinutes(distance.km);
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
        distanceKm: distance.km,
        distanceProvider: distance.provider,
        timeMinutes,
        airportId: airport?.id ?? null,
        routeId: routeId ?? null,
      },
    };

    const quoteDelegate = this.getQuoteDelegate();
    const created = await quoteDelegate.create({
      data: {
        tripType:
          dto.tripType === TripTypeDto.AIRPORT ? TripType.AIRPORT : TripType.ROAD,
        routeId: routeId ?? null,
        airportId: airport?.id ?? null,
        vehicleTypeId: dto.vehicleTypeId,
        basePriceVnd: basePrice,
        distanceKm: distance.km,
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

  private async resolveRoadDistance(
    dto: QuoteRequestDto,
    fallback: number,
  ): Promise<DistanceResolution> {
    if (dto.distanceKm && dto.distanceKm > 0) {
      return { km: dto.distanceKm, provider: 'request' };
    }
    if (fallback > 0) {
      return { km: fallback, provider: 'route' };
    }
    return this.resolveDistanceFromCoordinates(dto);
  }

  private async resolveAirportDistance(
    dto: QuoteRequestDto,
    airport: Airport,
  ): Promise<DistanceResolution> {
    const distance = dto.distanceKm && dto.distanceKm > 0
      ? { km: dto.distanceKm, provider: 'request' as DistanceProvider }
      : await this.resolveDistanceFromCoordinates(dto, airport);
    if (distance.km <= 0) {
      this.throwError(
        HttpStatus.BAD_REQUEST,
        'INVALID_DISTANCE',
        'Unable to resolve distance for airport trip',
      );
    }
    return distance;
  }

  private async resolveAirport(code: string | undefined): Promise<Airport> {
    if (!code) {
      this.throwError(
        HttpStatus.BAD_REQUEST,
        'AIRPORT_REQUIRED',
        'airportCode is required for AIRPORT trips',
      );
    }
    const airport = await this.prisma.airport.findFirst({ where: { code, isActive: true } });
    if (!airport) {
      this.throwError(
        HttpStatus.NOT_FOUND,
        'AIRPORT_NOT_FOUND',
        'Airport not found',
        { airportCode: code },
      );
    }
    return airport;
  }

  private async resolveDistanceFromCoordinates(
    dto: QuoteRequestDto,
    airport?: Airport | null,
  ): Promise<DistanceResolution> {
    const points: CoordinateInput[] = [];
    if (dto.fromLat != null && dto.fromLng != null) {
      points.push({ lat: dto.fromLat, lng: dto.fromLng });
    }
    if (dto.toLat != null && dto.toLng != null) {
      points.push({ lat: dto.toLat, lng: dto.toLng });
    }
    if (points.length === 2) {
      return this.getDrivingDistance(points[0], points[1]);
    }
    if (points.length === 1 && airport) {
      return this.getDrivingDistance(points[0], { lat: airport.lat, lng: airport.lng });
    }
    if (airport) {
      return { km: 0, provider: 'unknown' };
    }
    return { km: 0, provider: 'unknown' };
  }

  private async getDrivingDistance(
    from: CoordinateInput,
    to: CoordinateInput,
  ): Promise<DistanceResolution> {
    const normalizedFrom = this.normalizePoint(from, 'from');
    const normalizedTo = this.normalizePoint(to, 'to');
    let lastError: unknown;
    try {
      const { km, provider } = await this.maps.directions(normalizedFrom, normalizedTo);
      if (km > 0) {
        return { km: this.normalizeDistance(km), provider };
      }
      this.logger.warn('Driving distance providers returned zero distance', {
        from: normalizedFrom,
        to: normalizedTo,
      });
    } catch (error) {
      lastError = error;
      this.logger.error('Driving distance lookup failed', {
        error: error instanceof Error ? error.message : String(error),
        from: normalizedFrom,
        to: normalizedTo,
      });
    }

    const fallbackKm = this.getFallbackDistanceKm(normalizedFrom, normalizedTo);
    if (fallbackKm > 0) {
      this.logger.warn('Falling back to great-circle distance estimate', {
        from: normalizedFrom,
        to: normalizedTo,
        fallbackKm,
        lastError: lastError instanceof Error ? lastError.message : lastError ?? null,
      });
      return { km: this.normalizeDistance(fallbackKm), provider: 'approximate' };
    }

    return this.throwError(
      HttpStatus.BAD_GATEWAY,
      'DRIVING_DISTANCE_UNAVAILABLE',
      'Driving distance providers did not return a valid route',
      {
        from: normalizedFrom,
        to: normalizedTo,
        ...(lastError instanceof Error ? { cause: lastError.message } : {}),
      },
    );
  }

  private normalizeDistance(distanceKm: number): number {
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      return 0;
    }
    return Math.round(distanceKm * 100) / 100;
  }

  private getFallbackDistanceKm(from: NormalizedPoint, to: NormalizedPoint): number {
    // Haversine provides a resilient baseline when all routing APIs fail.
    const distanceKm = this.getGreatCircleDistanceKm(from, to);
    if (distanceKm <= 0) {
      return 0;
    }
    const inflated = distanceKm * FALLBACK_DISTANCE_MULTIPLIER;
    return Number.isFinite(inflated) && inflated > 0 ? inflated : 0;
  }

  private getGreatCircleDistanceKm(from: NormalizedPoint, to: NormalizedPoint): number {
    // Standard haversine formula for earth distance, safe for short and long ranges alike.
    const toRad = (degrees: number) => (degrees * Math.PI) / 180;
    const dLat = toRad(to.lat - from.lat);
    const dLng = toRad(to.lng - from.lng);
    const lat1 = toRad(from.lat);
    const lat2 = toRad(to.lat);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = EARTH_RADIUS_KM * c;
    return Number.isFinite(distance) && distance > 0 ? distance : 0;
  }

  private normalizePoint(point: CoordinateInput, label: string): NormalizedPoint {
    const lat = this.toNumber(point.lat);
    const lng = this.toNumber(point.lng);
    if (lat == null || lng == null) {
      this.logger.warn('Invalid coordinate provided for distance calculation', {
        label,
        point,
      });
      this.throwError(
        HttpStatus.BAD_REQUEST,
        'INVALID_COORDINATE',
        `Invalid ${label} coordinate supplied`,
        { label, point },
      );
    }
    return { lat, lng };
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (value == null) {
      return null;
    }
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private getQuoteDelegate(): QuoteCreateDelegate {
    const delegate = (
      this.prisma as unknown as Record<string, unknown>
    ).quote as QuoteCreateDelegate | undefined;
    if (!delegate || typeof delegate.create !== 'function') {
      this.throwError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'MISSING_SCHEMA_FIELD',
        'Quote model is not available in Prisma client',
      );
    }
    return delegate;
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
