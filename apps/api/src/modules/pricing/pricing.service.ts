import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { GoogleMapsService } from '../../infra/maps/maps.service';

type Direction = 'to_airport' | 'from_airport';
export interface QuoteDto {
  tripType: 'AIRPORT'|'ROAD';
  vehicleTypeId: number;
  fromText?: string; toText?: string;
  fromLat?: number; fromLng?: number; toLat?: number; toLng?: number;
  distanceKm?: number;
  roundTrip?: boolean;
  withVat?: boolean;
  vatPct?: number;
  couponCode?: string;
  stops?: string[];
  direction?: Direction;
  waitHours?: number;
  startAt?: string;
}

@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService, private maps: GoogleMapsService) {}

  private async distanceKm(dto: QuoteDto): Promise<number> {
    if (dto.distanceKm && dto.distanceKm > 0) return dto.distanceKm;
    if (dto.fromLat && dto.fromLng && dto.toLat && dto.toLng) {
      const d = await this.maps.directions({ lat: dto.fromLat, lng: dto.fromLng }, { lat: dto.toLat, lng: dto.toLng });
      return Math.max(0, Math.round(d.km * 10) / 10);
    }
    return 0;
  }

  async quote(dto: QuoteDto) {
    const vt = await this.prisma.vehicleType.findUnique({ where: { id: dto.vehicleTypeId } });
    if (!vt || !vt.isActive) throw new Error('Vehicle type not available');

    const settings = await this.prisma.siteSetting.findFirst();
    const waitRatePerHour = settings?.waitRatePerHour ?? 30000;   // VND/h
    const defaultVat = settings?.defaultVatPct ?? 10;

    const km = await this.distanceKm(dto);
    const perKm = vt.perKmVnd ?? 0;
    const priceDistanceVnd = Math.round(perKm * km);

    const waitMinutes = dto.roundTrip ? Math.max(0, Math.round((dto.waitHours ?? 0) * 60)) : 0;
    const priceWaitingVnd = Math.round(waitRatePerHour * (waitMinutes / 60));

    const subtotalVnd = priceDistanceVnd + priceWaitingVnd;
    const discountVnd = 0;

    const vatPct = dto.vatPct != null
      ? dto.vatPct
      : (dto.withVat ? defaultVat : 0);

    const vatVnd = Math.round(subtotalVnd * (vatPct / 100));
    const totalVnd = subtotalVnd - discountVnd + vatVnd;

    return {
      vehicleTypeId: dto.vehicleTypeId,
      distanceKm: km,
      perKmVnd: perKm,
      waitMinutes,
      waitRatePerHour,
      priceDistanceVnd,
      priceWaitingVnd,
      subtotalVnd,
      discountVnd,
      vatPct,
      defaultVatPct: defaultVat,
      vatVnd,
      totalVnd,
    };
  }
}
