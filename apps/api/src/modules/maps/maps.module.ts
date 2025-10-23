import { Module } from '@nestjs/common';
import { MapsController } from './maps.controller';
import { GoogleMapsService } from '../../infra/maps/maps.service';

@Module({
  controllers: [MapsController],
  providers: [GoogleMapsService],
  exports: [GoogleMapsService],
})
export class MapsModule {}
