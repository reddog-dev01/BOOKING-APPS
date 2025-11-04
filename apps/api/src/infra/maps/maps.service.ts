import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { apiBase, getMapsKey, hasMapsKey } from './map.util';
import type { DrivingDistanceResult } from './types';

export type { DrivingDistanceResult } from './types';

const enc = encodeURIComponent;

@Injectable()
export class GoogleMapsService {
  private readonly logger = new Logger(GoogleMapsService.name);

  async autocomplete(input: string, language = 'vi') {
    const key = getMapsKey();
    if (!key) throw new HttpException('Maps not configured', 501);
    const url = `${apiBase}/place/autocomplete/json`
      + `?input=${enc(input || '')}`
      + `&components=country:vn`
      + `&types=geocode`
      + `&language=${enc(language)}`
      + `&key=${enc(key)}`;
    const resp = await fetch(url);
    return resp.json();
  }

  async directions(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<DrivingDistanceResult> {
    const providers: Array<{
      name: DrivingDistanceResult['provider'];
      resolver: () => Promise<DrivingDistanceResult>;
    }> = [];

    if (hasMapsKey()) {
      providers.push({ name: 'google', resolver: () => this.lookupGoogleDirections(from, to) });
    }
    providers.push({ name: 'osrm', resolver: () => this.lookupOsrmRoute(from, to) });

    let lastError: unknown;
    let lastProvider: DrivingDistanceResult['provider'] | undefined;

    for (const { resolver, name } of providers) {
      try {
        const result = await resolver();
        if (Number.isFinite(result.meters) && result.meters > 0) {
          return result;
        }
        this.logger.warn('Driving distance provider returned non-positive result', {
          provider: name,
          meters: result.meters,
        });
        lastProvider = name;
      } catch (error) {
        lastError = error;
        lastProvider = name;
        this.logger.warn('Driving distance provider failed', {
          provider: name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.error('All driving distance providers failed', {
      providers: providers.map(({ name }) => name),
      lastProvider: lastProvider ?? null,
      lastError: lastError instanceof Error ? lastError.message : lastError ?? null,
    });

    throw new HttpException(
      {
        error: 'DRIVING_DISTANCE_UNAVAILABLE',
        message: 'No routing provider returned a valid driving distance',
        details: {
          providers: providers.map(({ name }) => name),
          lastProvider: lastProvider ?? null,
          ...(lastError instanceof Error ? { cause: lastError.message } : {}),
        },
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  private async lookupGoogleDirections(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<DrivingDistanceResult> {
    const key = getMapsKey();
    if (!key) {
      throw new HttpException('Maps not configured', 501);
    }

    const url = `${apiBase}/directions/json`
      + `?origin=${from.lat},${from.lng}`
      + `&destination=${to.lat},${to.lng}`
      + `&mode=driving`
      + `&region=vn`
      + `&key=${enc(key)}`;

    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Google Directions HTTP ${resp.status}`);
    }
    const json = await resp.json();
    const status = json?.status;
    if (status !== 'OK') {
      this.logger.warn('Google Directions response not OK', {
        status,
        errorMessage: json?.error_message,
      });
      return this.toResult('google', 0, json);
    }
    const meters = json?.routes?.[0]?.legs?.[0]?.distance?.value ?? 0;
    return this.toResult('google', meters, json);
  }

  private async lookupOsrmRoute(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<DrivingDistanceResult> {
    const base = (process.env.OSRM_BASE_URL || 'https://router.project-osrm.org').replace(/\/+$/, '');
    const url = `${base}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}`
      + '?overview=false&annotations=duration,distance';

    const resp = await fetch(url, {
      headers: { 'user-agent': 'booking-api/1.0 (distance resolver)' },
    });
    if (!resp.ok) {
      this.logger.warn('OSRM request failed', { status: resp.status, statusText: resp.statusText });
      return this.toResult('osrm', 0, { status: resp.status });
    }

    const json = await resp.json();
    if (json?.code !== 'Ok') {
      this.logger.warn('OSRM response not OK', { code: json?.code });
      return this.toResult('osrm', 0, json);
    }

    const meters = json?.routes?.[0]?.distance ?? 0;
    return this.toResult('osrm', meters, json);
  }

  private toResult(
    provider: DrivingDistanceResult['provider'],
    meters: number,
    raw: unknown,
  ): DrivingDistanceResult {
    const sanitizedMeters = Number.isFinite(meters) && meters > 0 ? meters : 0;
    const km = sanitizedMeters > 0
      ? Math.round((sanitizedMeters / 1000) * 100) / 100
      : 0;
    return { meters: sanitizedMeters, km, provider, raw };
  }
}
