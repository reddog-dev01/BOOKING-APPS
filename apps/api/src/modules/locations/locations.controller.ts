import { Controller, Get, HttpCode, Query } from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private svc: LocationsService) {}

  @Get('autocomplete') @HttpCode(200)
  autocomplete(@Query('q') q: string, @Query('lang') lang?: string) {
    return this.svc.autocomplete(q, (lang as string) || 'vi');
  }

  @Get('airports') @HttpCode(200)
  airports(@Query('active') active?: string) {
    const activeOnly = (active ?? 'true').toLowerCase() !== 'false';
    return this.svc.airports(activeOnly);
  }
}
