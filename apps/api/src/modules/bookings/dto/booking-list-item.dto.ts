import { BookingStatus, TripType } from '@prisma/client';

export class BookingListItemDto {
  id!: string;
  quoteId!: string | null;
  customerName!: string | null;
  phone!: string | null;
  totalVnd!: number;
  createdAt!: string;
  startAt!: string;
  status!: BookingStatus;
  tripType!: TripType;
  vehicleTypeName!: string | null;
  fromText!: string;
  toText!: string;
}
