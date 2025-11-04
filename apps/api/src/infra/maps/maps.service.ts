import { HttpException, Injectable, Logger } from '@nestjs/common';

import { apiBase, getMapsKey, hasMapsKey } from './map.util';

const enc = encodeURIComponent;

export interface DrivingDistanceResult {
  meters: number;
  km: number;
  provider: 'google' | 'osrm';
  raw: unknown;
}

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
    const providers: Array<() => Promise<DrivingDistanceResult>> = [];

    if (hasMapsKey()) {
      providers.push(() => this.lookupGoogleDirections(from, to));
    }
    providers.push(() => this.lookupOsrmRoute(from, to));

    for (const resolver of providers) {
      try {
        const result = await resolver();
        if (result.meters > 0) {
          return result;
        }
      } catch (error) {
        this.logger.warn('Driving distance provider failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { meters: 0, km: 0, provider: 'osrm', raw: null };
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
    const json = await resp.json();
    const status = json?.status;
    if (status !== 'OK') {
      this.logger.warn('Google Directions response not OK', {
        status,
        errorMessage: json?.error_message,
      });
      return { meters: 0, km: 0, provider: 'google', raw: json };
    }
    const meters = json?.routes?.[0]?.legs?.[0]?.distance?.value ?? 0;
    const km = Math.round((meters / 1000) * 100) / 100;
    return { meters, km, provider: 'google', raw: json };
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
      return { meters: 0, km: 0, provider: 'osrm', raw: { status: resp.status } };
    }

    const json = await resp.json();
    if (json?.code !== 'Ok') {
      this.logger.warn('OSRM response not OK', { code: json?.code });
      return { meters: 0, km: 0, provider: 'osrm', raw: json };
    }

    const meters = json?.routes?.[0]?.distance ?? 0;
    const km = Math.round((meters / 1000) * 100) / 100;
    return { meters, km, provider: 'osrm', raw: json };
  }
}
