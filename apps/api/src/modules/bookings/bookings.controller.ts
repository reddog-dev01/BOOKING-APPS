import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
@Controller('bookings')
export class BookingsController {
  constructor(private readonly svc: BookingsService) {}
  @Post() @HttpCode(201) create(@Body() dto: CreateBookingDto) { return this.svc.create(dto); }
  @Get(':id') @HttpCode(200) get(@Param('id') id: string) { return this.svc.get(id); }
}
