import type { FastifyRequest } from 'fastify';

export interface RateLimitOptions {
  max: number;
  windowMs: number;
  allowList: Set<string>;
}

interface RateLimitState {
  count: number;
  expiresAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export class RateLimitMiddleware {
  private readonly store = new Map<string, RateLimitState>();

  readonly max: number;

  private readonly windowMs: number;

  private readonly allowList: Set<string>;

  constructor(options: RateLimitOptions) {
    this.max = Math.max(1, Math.floor(options.max));
    this.windowMs = Math.max(1, Math.floor(options.windowMs));
    this.allowList = options.allowList;
  }

  consume(request: FastifyRequest, now = Date.now()): RateLimitResult {
    const clientIp = this.resolveClientIp(request);
    if (this.allowList.has(clientIp)) {
      return { allowed: true, remaining: this.max, retryAfterMs: 0 };
    }

    const state = this.store.get(clientIp);
    if (!state || state.expiresAt <= now) {
      this.store.set(clientIp, { count: 1, expiresAt: now + this.windowMs });
      return { allowed: true, remaining: this.max - 1, retryAfterMs: this.windowMs };
    }

    if (state.count >= this.max) {
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, state.expiresAt - now) };
    }

    state.count += 1;
    this.store.set(clientIp, state);
    return {
      allowed: true,
      remaining: Math.max(0, this.max - state.count),
      retryAfterMs: Math.max(0, state.expiresAt - now),
    };
  }

  reset(ip?: string) {
    if (!ip) {
      this.store.clear();
      return;
    }
    this.store.delete(ip);
  }

  private resolveClientIp(request: FastifyRequest): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0]?.trim() ?? request.ip;
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return String(forwarded[0]).split(',')[0]?.trim() ?? request.ip;
    }
    return request.ip;
  }
}
