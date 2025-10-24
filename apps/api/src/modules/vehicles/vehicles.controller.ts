import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';

import { ListVehiclesQueryDto } from './dto/list-vehicles-query.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehicleResponseDto } from './dto/vehicle-response.dto';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  list(@Query() query: ListVehiclesQueryDto): Promise<VehicleResponseDto[]> {
    const activeOnly = query.activeOnly ?? true;
    return this.vehiclesService.list(activeOnly);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVehicleDto,
  ): Promise<VehicleResponseDto> {
    return this.vehiclesService.update(id, dto);
  }
}
