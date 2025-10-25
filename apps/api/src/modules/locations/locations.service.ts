import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { GoogleMapsService } from '../../infra/maps/maps.service';

@Injectable()
export class LocationsService {
  constructor(
    private prisma: PrismaService,
    private maps: GoogleMapsService,
  ) {}

  autocomplete(q: string, language = 'vi') {
    return this.maps.autocomplete(q ?? '', language);
  }

  airports(activeOnly = true) {
    return this.prisma.airport.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, address: true, lat: true, lng: true, isActive: true },
    });
  }
}
