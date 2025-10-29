import { Body, Controller, Get, Patch } from '@nestjs/common';

import { SiteSettingsResponseDto } from './dto/site-settings.response';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get(): Promise<SiteSettingsResponseDto> {
    return this.settingsService.get();
  }

  @Patch()
  update(@Body() dto: UpdateSettingsDto): Promise<SiteSettingsResponseDto> {
    return this.settingsService.update(dto);
  }
}
