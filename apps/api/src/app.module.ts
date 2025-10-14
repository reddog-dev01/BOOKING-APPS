import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { SettingsModule } from './settings/settings.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { GeoModule } from './geo/geo.module';
import { PricingModule } from './pricing/pricing.module';
import { BookingsModule } from './bookings/bookings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../prisma/.env'] }),
    ThrottlerModule.forRoot([{
      ttl: parseInt(process.env.RATE_LIMIT_TTL_SEC ?? '60', 10),
      limit: parseInt(process.env.RATE_LIMIT_MAX ?? '60', 10),
    }]),
    PrismaModule,
    SettingsModule,
    VehiclesModule,
    GeoModule,
    PricingModule,
    BookingsModule,
  ],
})
export class AppModule {}
