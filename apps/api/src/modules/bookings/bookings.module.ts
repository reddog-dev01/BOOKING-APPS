import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PricingModule } from '../pricing/pricing.module';
import { MapsModule } from '../maps/maps.module';
import { PrismaModule } from '../../infra/prisma/prisma.module';
@Module({
  imports: [PrismaModule, MapsModule, PricingModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
