import { UiBookingState, QuoteRequestDto } from './types';

// Map UI -> API DTO (chuẩn hoá enum, field)
export function toQuoteDto(ui: UiBookingState): QuoteRequestDto {
  return {
    tripType: ui.tripType === 'airport' ? 'AIRPORT' : 'ROAD',
    routeCode: ui.routeCode,
    vehicleTypeId: ui.vehicleTypeId,
    startAt: ui.startAt,
    roundTrip: ui.roundTrip,
    withVat: ui.withVat,
    couponCode: ui.couponCode?.trim() || undefined,
  };
}
