/* ====== FE <-> API DTOs ====== */

export type TripTypeDto = "AIRPORT" | "ROAD";
export type DirectionDto = "IN" | "OUT";

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
  direction?: DirectionDto; // "IN" | "OUT"

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
  id: string;
  vehicleTypeId: number;
  basePrice: number;
  distanceKm: number;
  timeMinutes: number;
  vatPct: number;
  vatAmount: number;
  total: number; // tổng tiền từ BE
  totalVnd?: number; // giữ tương thích ngược nếu BE đổi field
  currency: "VND";
  expiresAt: string;
  meta?: {
    computed?: {
      distanceKm?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
};

export type CreateBookingRequestDto = QuoteRequestDto & {
  stops?: string[]; // danh sách điểm dừng
  customerName: string;
  customerPhone: string; // đã chuẩn hoá 0xxxxxxxx
  customerNote?: string;
  quoteId: string; // liên kết bắt buộc với quote hợp lệ
};

export type CreateBookingResponse = {
  bookingId: string;
  status: "PENDING" | "CONFIRMED";
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
