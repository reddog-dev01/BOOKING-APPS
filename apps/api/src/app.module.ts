import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { PrismaModule } from './infra/prisma/prisma.module';
import { MapsModule } from './modules/maps/maps.module';
import { LocationsModule } from './modules/locations/locations.module';
import { SettingsModule } from './modules/settings/settings.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { HealthController } from './app/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    ThrottlerModule.forRoot([{
      ttl: parseInt(process.env.RATE_LIMIT_TTL_SEC ?? '60', 10),
      limit: parseInt(process.env.RATE_LIMIT_MAX ?? '60', 10),
    }]),
    PrismaModule,
    MapsModule,
    LocationsModule,
    SettingsModule,
    VehiclesModule,
    PricingModule,
    BookingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
