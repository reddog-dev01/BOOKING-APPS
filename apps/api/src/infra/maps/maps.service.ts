import { Injectable, HttpException } from '@nestjs/common';
import { apiBase, hasMapsKey } from './map.util';

const enc = encodeURIComponent;

@Injectable()
export class GoogleMapsService {
  async autocomplete(input: string, language = 'vi') {
    if (!hasMapsKey()) throw new HttpException('Maps not configured', 501);
    const url = `${apiBase}/place/autocomplete/json`
      + `?input=${enc(input || '')}`
      + `&components=country:vn`
      + `&types=geocode`
      + `&language=${enc(language)}`
      + `&key=${enc(process.env.GOOGLE_MAPS_API_KEY!)}`;
    const resp = await fetch(url);
    return resp.json();
  }

  async directions(from: { lat:number; lng:number }, to: { lat:number; lng:number }) {
    if (!hasMapsKey()) throw new HttpException('Maps not configured', 501);
    const url = `${apiBase}/directions/json`
      + `?origin=${from.lat},${from.lng}`
      + `&destination=${to.lat},${to.lng}`
      + `&mode=driving`
      + `&region=vn`
      + `&key=${enc(process.env.GOOGLE_MAPS_API_KEY!)}`;
    const resp = await fetch(url);
    type DirectionsResponse = {
      routes?: Array<{
        legs?: Array<{
          distance?: { value?: number | null } | null;
        }> | null;
      }>;
    };
    const json = (await resp.json()) as DirectionsResponse;
    const meters = json.routes?.[0]?.legs?.[0]?.distance?.value ?? 0;
    const km = Math.round((meters / 1000) * 10) / 10;
    return { meters, km, raw: json };
  }
}
