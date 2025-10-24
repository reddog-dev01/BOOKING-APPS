import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './infra/prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './app/health.controller';
import { PricingController } from './modules/pricing/pricing.controller';
import { PricingService } from './modules/pricing/pricing.service';
import { BookingsController } from './modules/bookings/bookings.controller';
import { BookingsService } from './modules/bookings/bookings.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }), PrismaModule],
  controllers: [AppController, HealthController, PricingController, BookingsController],
  providers: [AppService, PricingService, BookingsService],
})
export class AppModule {}
