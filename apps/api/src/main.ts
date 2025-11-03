import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';

import { AppModule } from './app.module';
import { PrismaService } from './infra/prisma/prisma.service';
import { RateLimitMiddleware } from './common/rate-limit/rate-limit.middleware';

function parseCsv(input: string | undefined, fallback: string[]): string[] {
  if (!input) {
    return fallback;
  }
  return input
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function parseWindowMs(input: string | undefined, defaultMs: number): number {
  if (!input) {
    return defaultMs;
  }
  const normalized = input.trim().toLowerCase();
  const numeric = Number(normalized);
  if (!Number.isNaN(numeric)) {
    return Math.max(1, numeric) * 1000;
  }
  const match = normalized.match(/^(\d+)\s*(second|seconds|minute|minutes|hour|hours)$/);
  if (!match) {
    return defaultMs;
  }
  const value = Number(match[1]);
  const unit = match[2];
  if (['second', 'seconds'].includes(unit)) {
    return value * 1000;
  }
  if (['minute', 'minutes'].includes(unit)) {
    return value * 60 * 1000;
  }
  return value * 60 * 60 * 1000;
}

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3006);
  const adapter = new FastifyAdapter({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      base: undefined,
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
    },
    trustProxy: true,
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);
  const fastify = app.getHttpAdapter().getInstance() as FastifyInstance; // Reuse Fastify logger for infra-level events.

  const defaultOrigins = [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3005',
    'http://127.0.0.1:3005',
    'http://localhost:3007',
    'http://127.0.0.1:3007',
    'http://localhost:3008',
    'http://127.0.0.1:3008',
  ];

  const normalizeOrigin = (origin: string | undefined) => {
    if (!origin) {
      return undefined;
    }
    try {
      const url = new URL(origin);
      const normalized = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
      return normalized.toLowerCase();
    } catch {
      return origin.replace(/\/$/, '').toLowerCase();
    }
  };

  const allowedOrigins = new Set(
    parseCsv(process.env.CORS_ORIGINS, defaultOrigins)
      .map((value) => normalizeOrigin(value))
      .filter((value): value is string => Boolean(value)),
  );

  await app.register(cors, {
    origin: (origin, callback) => {
      const normalized = normalizeOrigin(origin);
      if (!origin) {
        callback(null, true);
        return;
      }
      if (normalized && allowedOrigins.has(normalized)) {
        callback(null, true); // Mirror the requesting origin when trusted so credentialed requests succeed.
        return;
      }
      fastify.log.warn({ origin }, 'blocked CORS origin');
      callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(compress);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const rateLimiter = new RateLimitMiddleware({
    max: Number.isNaN(Number(process.env.RL_MAX))
      ? 120
      : Math.max(1, Number(process.env.RL_MAX)),
    windowMs: parseWindowMs(process.env.RL_WINDOW, 60_000),
    allowList: new Set(parseCsv(process.env.RL_ALLOWLIST, [])),
  });

  fastify.addHook('onRequest', async (request, reply) => {
    const result = rateLimiter.consume(request);
    if (!result.allowed) {
      reply
        .code(429)
        .headers({
          'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)),
          'X-RateLimit-Limit': String(rateLimiter.max),
          'X-RateLimit-Remaining': '0',
        })
        .send({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          details: { retryAfterMs: result.retryAfterMs },
        });
      return reply;
    }

    reply.header('X-RateLimit-Limit', String(rateLimiter.max));
    reply.header('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));
    return undefined;
  });

  const prismaService = app.get(PrismaService);
  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    fastify.log.warn({ signal }, 'received shutdown signal');
    await prismaService.$disconnect();
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));

  await app.listen(port, '0.0.0.0');
  fastify.log.info({ port }, 'API server is listening');
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap application', error);
  process.exit(1);
});
