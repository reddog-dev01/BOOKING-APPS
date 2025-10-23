import { UiBookingState, QuoteRequestDto } from './types';

// Map UI -> API DTO (chuẩn hoá enum, field)
export function toQuoteDto(ui: UiBookingState): QuoteRequestDto {
  return {
    tripType: ui.tripType === 'airport' ? 'AIRPORT' : 'ROAD',
    routeCode: ui.tripType === 'road' ? ui.routeCode : undefined,
    vehicleTypeId: ui.vehicleTypeId,
    startAt: ui.startAt,
    roundTrip: ui.roundTrip,
    withVat: ui.withVat,
    vatPct: ui.vatPct,
    fromText: ui.fromText,
    toText: ui.toText,
    fromLat: ui.fromLat,
    fromLng: ui.fromLng,
    toLat: ui.toLat,
    toLng: ui.toLng,
    distanceKm: ui.distanceKm,
    airportCode: ui.tripType === 'airport' ? ui.airportCode : undefined,
    direction: ui.tripType === 'airport' ? ui.direction : undefined,
    waitHours: ui.waitHours,
    couponCode: ui.couponCode?.trim() || undefined,
    stops: ui.stops
      ?.map((s) => s.text.trim())
      .filter((text) => text.length > 0),
  };
}
