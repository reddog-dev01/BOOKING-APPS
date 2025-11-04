export interface DrivingDistanceResult {
  /** Distance in meters returned by routing providers. */
  meters: number;
  /** Same distance converted to kilometers with two decimal precision. */
  km: number;
  /** Provider that supplied the distance, for observability and debugging. */
  provider: 'google' | 'osrm';
  /** Raw provider payload for downstream analysis (kept opaque intentionally). */
  raw: unknown;
}
