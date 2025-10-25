import { QuoteRequestDto, UiBookingState } from "./types";

// Map UI -> API DTO (chuẩn hoá enum, field)
export function toQuoteDto(ui: UiBookingState): QuoteRequestDto {
  const dto: QuoteRequestDto = {
    tripType: ui.tripType === "airport" ? "AIRPORT" : "ROAD",
    vehicleTypeId: ui.vehicleTypeId,
    startAt: ui.startAt,
    roundTrip: ui.roundTrip,
    withVat: ui.withVat,
    couponCode: ui.couponCode?.trim() || undefined,
    vatPct: ui.vatPct,
    fromText: ui.fromText,
    toText: ui.toText,
    fromLat: ui.fromLat,
    fromLng: ui.fromLng,
    toLat: ui.toLat,
    toLng: ui.toLng,
    distanceKm: ui.distanceKm,
  };

  if (ui.tripType === "airport") {
    dto.airportCode = ui.airportCode;
    dto.direction = ui.direction;
  } else {
    dto.routeCode = ui.routeCode;
  }

  const normalizedStops = (ui.stops ?? []).map((s) => s.trim()).filter(Boolean);
  if (normalizedStops.length) {
    dto.stops = normalizedStops;
  }

  if (ui.roundTrip && typeof ui.waitHours === "number") {
    dto.waitHours = ui.waitHours;
  }

  return dto;
}
