export class CreateBookingResponseDto {
  bookingId!: string;
  status!: 'PENDING' | 'CONFIRMED';
}
