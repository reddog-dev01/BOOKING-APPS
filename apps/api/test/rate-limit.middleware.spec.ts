import { RateLimitMiddleware } from '../src/common/rate-limit/rate-limit.middleware';

describe('RateLimitMiddleware', () => {
  it('should allow up to the configured max requests per window', () => {
    const limiter = new RateLimitMiddleware({ max: 2, windowMs: 1_000, allowList: new Set() });
    const req = { headers: {}, ip: '127.0.0.1' } as any;

    const first = limiter.consume(req, 0);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);

    const second = limiter.consume(req, 10);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);

    const third = limiter.consume(req, 20);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThanOrEqual(0);
  });

  it('should ignore allowlisted IP addresses', () => {
    const limiter = new RateLimitMiddleware({ max: 1, windowMs: 1_000, allowList: new Set(['10.0.0.1']) });
    const req = { headers: {}, ip: '10.0.0.1' } as any;

    const first = limiter.consume(req, 0);
    const second = limiter.consume(req, 1);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);
  });
});
