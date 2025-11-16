import { BookingListItemDto } from './booking-list-item.dto';

export class ListBookingsResponseDto {
  items!: BookingListItemDto[];
  nextCursor?: string;
  hasMore!: boolean;
}
