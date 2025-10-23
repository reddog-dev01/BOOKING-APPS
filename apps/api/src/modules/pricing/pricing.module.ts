import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { MapsModule } from '../maps/maps.module';

@Module({
  imports: [MapsModule],               // cần để inject GoogleMapsService
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
