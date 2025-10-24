import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, SiteSetting } from '@prisma/client';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { SiteSettingsResponseDto } from './dto/site-settings.response';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const DEFAULT_SETTINGS: SiteSettingsResponseDto = {
  vatOptions: [0, 8, 10],
  defaultVatPct: 10,
  waitRatePerHour: 30000,
  roundTripWaitMinutes: 90,
  mapProvider: 'google',
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<SiteSettingsResponseDto> {
    const record = await this.prisma.siteSetting.findUnique({ where: { id: 1 } });
    if (!record) {
      return DEFAULT_SETTINGS;
    }
    return this.toResponse(record);
  }

  async update(dto: UpdateSettingsDto): Promise<SiteSettingsResponseDto> {
    const vatOptions = this.normalizeVatOptions(dto.vatOptions);
    if (vatOptions.length === 0) {
      this.throwError(HttpStatus.BAD_REQUEST, 'VAT_OPTIONS_EMPTY', 'vatOptions must include at least one value');
    }
    if (!vatOptions.includes(dto.defaultVatPct)) {
      this.throwError(
        HttpStatus.BAD_REQUEST,
        'VAT_DEFAULT_INVALID',
        'defaultVatPct must be included in vatOptions',
        { vatOptions, defaultVatPct: dto.defaultVatPct },
      );
    }

    const vatOptionsJson = vatOptions as unknown as Prisma.InputJsonValue;

    const payload: Prisma.SiteSettingUpsertArgs['create'] = {
      id: 1,
      vatOptions: vatOptionsJson,
      defaultVatPct: dto.defaultVatPct,
      waitRatePerHour: dto.waitRatePerHour,
      roundTripWaitMinutes: dto.roundTripWaitMinutes,
      mapProvider: dto.mapProvider,
    };

    const updated = await this.prisma.siteSetting.upsert({
      where: { id: 1 },
      update: {
        vatOptions: vatOptionsJson,
        defaultVatPct: dto.defaultVatPct,
        waitRatePerHour: dto.waitRatePerHour,
        roundTripWaitMinutes: dto.roundTripWaitMinutes,
        mapProvider: dto.mapProvider,
      },
      create: payload,
    });

    return this.toResponse(updated);
  }

  private normalizeVatOptions(values: number[]): number[] {
    return Array.from(new Set(values.map((value) => Math.max(0, Math.round(value))))).sort((a, b) => a - b);
  }

  private toResponse(record: SiteSetting): SiteSettingsResponseDto {
    const vatOptions = this.parseVatOptions(record.vatOptions);
    return {
      vatOptions: vatOptions.length > 0 ? vatOptions : DEFAULT_SETTINGS.vatOptions,
      defaultVatPct: record.defaultVatPct,
      waitRatePerHour: record.waitRatePerHour,
      roundTripWaitMinutes: record.roundTripWaitMinutes,
      mapProvider: record.mapProvider,
    };
  }

  private parseVatOptions(value: Prisma.JsonValue | null): number[] {
    if (!Array.isArray(value)) {
      return [];
    }
    const parsed = value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item) && item >= 0);
    return Array.from(new Set(parsed.map((item) => Math.round(item)))).sort((a, b) => a - b);
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
