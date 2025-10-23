import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get(['healthz', 'health'])
  health() {
    return { ok: true, ts: new Date().toISOString() };
  }
}
