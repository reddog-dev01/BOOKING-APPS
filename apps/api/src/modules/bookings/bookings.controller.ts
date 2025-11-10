import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateBookingResponseDto } from './dto/create-booking.res.dto';
import { BookingsService } from './bookings.service';
import { ExportBookingsQueryDto, ListBookingsQueryDto } from './dto/list-bookings.query.dto';
import { ListBookingsResponseDto } from './dto/list-bookings.res.dto';

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

  @Get()
  list(@Query() query: ListBookingsQueryDto): Promise<ListBookingsResponseDto> {
    return this.bookingsService.list(query);
  }

  @Get('export')
  async export(
    @Query() query: ExportBookingsQueryDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<void> {
    const { filename, buffer } = await this.bookingsService.export(query);
    res.header('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
