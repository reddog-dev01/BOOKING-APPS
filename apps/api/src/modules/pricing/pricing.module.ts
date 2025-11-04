import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infra/prisma/prisma.module';
import { MapsModule } from '../maps/maps.module';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

@Module({
  imports: [PrismaModule, MapsModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
