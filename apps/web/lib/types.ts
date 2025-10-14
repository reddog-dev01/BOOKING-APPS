// UI state (từ BookingForm)
export type UiBookingState = {
  tripType: 'airport' | 'road';
  routeCode: string;               // ví dụ: "HN-NB"
  vehicleTypeId: number;
  startAt: string;                 // ISO, ví dụ "2025-10-09T10:30:00+07:00"
  roundTrip: boolean;              // UI tick "2 chiều"
  withVat: boolean;
  couponCode?: string;
};

// DTO gửi API (khớp Nest DTO)
export type QuoteRequestDto = {
  tripType: 'AIRPORT' | 'ROAD';
  routeCode: string;
  vehicleTypeId: number;
  startAt: string;
  roundTrip: boolean;
  withVat: boolean;
  couponCode?: string;
};

export type QuoteResponse = {
  basePrice: number;
  roundTripAdjPct: number;
  nightAdjPct: number;
  vatPct: number;
  discountPct: number;
  finalPrice: number;
  breakdown: string[];
};

export type CreateBookingRequestDto = QuoteRequestDto & {
  fromText?: string;
  toText?: string;
  customerName?: string;
  phone?: string;
  stopsJson?: any; // hoặc type cụ thể
};

export type CreateBookingResponse = {
  bookingId: string;
  totalVnd: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELED' | 'EXPIRED';
};
