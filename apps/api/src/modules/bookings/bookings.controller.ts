import { Body, Controller, Post } from '@nestjs/common';

import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateBookingResponseDto } from './dto/create-booking.res.dto';
import { BookingsService } from './bookings.service';

// Sample curl (DEV):
// QUOTE_ID="00000000-0000-0000-0000-000000000000"
// curl -i -H 'content-type: application/json' \
//   -d '{"quoteId":"'"$QUOTE_ID"'","customerName":"A","customerPhone":"+84900000000","fromText":"Noi Bai","toText":"Hoan Kiem"}' \
//   http://localhost:3006/bookings
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  create(@Body() dto: CreateBookingDto): Promise<CreateBookingResponseDto> {
    return this.bookingsService.create(dto);
  }
}
