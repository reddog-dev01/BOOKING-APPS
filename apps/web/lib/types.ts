/* ====== FE <-> API DTOs ====== */

export type TripTypeDto = "AIRPORT" | "ROAD";
export type DirectionDto = "to_airport" | "from_airport";

export type UiTripType = "airport" | "road";

export type QuoteRequestDto = {
  tripType: TripTypeDto; // "AIRPORT" | "ROAD"
  vehicleTypeId: number;
  startAt: string; // ISO "yyyy-mm-ddTHH:MM"
  roundTrip: boolean;
  withVat: boolean; // VAT tick: true/false (mức % BE tự quyết theo cấu hình admin)

  // Optional VAT percentage override
  vatPct?: number;

  // Route + airport meta
  routeCode?: string;
  airportCode?: string; // ví dụ "HAN"
  direction?: DirectionDto; // "to_airport" | "from_airport"

  // text + toạ độ (ưu tiên toạ độ để tính km driving)
  fromText?: string;
  toText?: string;
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;

  distanceKm?: number;
  waitHours?: number; // >= 0

  // Coupon & stops optional
  couponCode?: string;
  stops?: string[];
};

export type QuoteResponse = {
  id?: string; // nếu BE có sinh id cho quote
  currency?: "VND";
  totalVnd: number; // tổng tiền (đã gồm VAT nếu withVat = true)
  // có thể bổ sung breakdown nếu BE trả về
};

export type CreateBookingRequestDto = QuoteRequestDto & {
  stops?: string[]; // danh sách điểm dừng
  customerName: string;
  phone: string; // đã chuẩn hoá 0xxxxxxxx
  quoteId?: string; // nếu muốn liên kết quote
};

export type CreateBookingResponse = {
  id: string;
  status: "confirmed" | "pending" | "failed";
};

export type UiBookingState = {
  tripType: UiTripType;
  airportCode?: string;
  direction?: DirectionDto;
  routeCode?: string;
  vehicleTypeId: number;
  startAt: string;
  roundTrip: boolean;
  withVat: boolean;
  couponCode?: string;
  vatPct?: number;
  fromText: string;
  fromLat?: number;
  fromLng?: number;
  toText: string;
  toLat?: number;
  toLng?: number;
  distanceKm?: number;
  waitHours?: number;
  stops: string[];
};
