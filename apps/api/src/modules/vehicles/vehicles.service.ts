import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { VehicleResponseDto } from './dto/vehicle-response.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(activeOnly: boolean): Promise<VehicleResponseDto[]> {
    const vehicles = await this.prisma.vehicleType.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        capacity: true,
        trunkSize: true,
        perKmVnd: true,
        isActive: true,
      },
    });
    return vehicles;
  }

  async update(id: number, dto: UpdateVehicleDto): Promise<VehicleResponseDto> {
    const vehicle = await this.prisma.vehicleType.findUnique({ where: { id } });
    if (!vehicle) {
      this.throwError(HttpStatus.NOT_FOUND, 'VEHICLE_NOT_FOUND', 'Vehicle type not found', { id });
    }

    const updated = await this.prisma.vehicleType.update({
      where: { id },
      data: {
        perKmVnd: dto.perKmVnd,
        isActive: dto.isActive,
      },
      select: {
        id: true,
        name: true,
        capacity: true,
        trunkSize: true,
        perKmVnd: true,
        isActive: true,
      },
    });

    return updated;
  }

  private throwError(
    status: HttpStatus,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ): never {
    throw new HttpException({ error: code, message, details }, status);
  }
}
