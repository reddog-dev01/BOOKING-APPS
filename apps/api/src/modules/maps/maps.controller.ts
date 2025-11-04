import { Controller, Get, HttpCode, Query } from '@nestjs/common';
import { GoogleMapsService } from '../../infra/maps/maps.service';
import { DrivingDistanceResult } from '../../infra/maps/types';

@Controller('maps')
export class MapsController {
  constructor(private svc: GoogleMapsService) {}

  @Get('autocomplete') @HttpCode(200)
  autocomplete(@Query('q') q: string) { return this.svc.autocomplete(q ?? ''); }

  @Get('directions') @HttpCode(200)
  directions(
    @Query('fromLat') fromLat: string, @Query('fromLng') fromLng: string,
    @Query('toLat') toLat: string, @Query('toLng') toLng: string,
  ): Promise<DrivingDistanceResult> {
    return this.svc.directions(
      { lat: parseFloat(fromLat), lng: parseFloat(fromLng) },
      { lat: parseFloat(toLat),  lng: parseFloat(toLng)  },
    );
  }
}
