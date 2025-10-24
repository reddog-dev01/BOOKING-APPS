export class QuoteResponseDto {
  id!: string;
  vehicleTypeId!: number;
  basePrice!: number;
  distanceKm!: number;
  timeMinutes!: number;
  vatPct!: number;
  vatAmount!: number;
  total!: number;
  currency!: 'VND' | 'USD';
  expiresAt!: string;
  meta?: Record<string, unknown>;
}
