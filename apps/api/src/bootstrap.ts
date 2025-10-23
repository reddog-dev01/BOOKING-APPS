import { RequestMethod, ValidationPipe } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

function resolveVersion() {
  return process.env.npm_package_version ?? 'dev';
}

export async function configureApp(app: NestFastifyApplication) {
  app.setGlobalPrefix('api', {
    exclude: [
      { path: '/', method: RequestMethod.ALL },
      { path: 'health', method: RequestMethod.GET },
      { path: 'healthz', method: RequestMethod.GET },
    ],
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      const allow = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (!origin || allow.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(compress, {});
  await app.register(rateLimit, {
    max: Number(process.env.RL_MAX ?? 120),
    timeWindow: process.env.RL_WINDOW ?? '1 minute',
    ban: Number(process.env.RL_BAN ?? 0),
    keyGenerator: (req) => String(req.headers['x-forwarded-for'] ?? req.ip),
    addHeadersOnExceeding: { 'x-ratelimit-remaining': true },
    addHeaders: { 'x-ratelimit-limit': true, 'x-ratelimit-remaining': true, 'retry-after': true },
    allowList: (req) => {
      const ip = String(req.headers['x-forwarded-for'] ?? req.ip).split(',')[0].trim();
      const wl = (process.env.RL_ALLOWLIST ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return wl.includes(ip);
    },
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const fastify = app.getHttpAdapter().getInstance<FastifyInstance>();
  fastify.get('/', async (_request, reply) => {
    reply
      .code(200)
      .header('cache-control', 'no-store')
      .send({
        name: 'booking-api',
        version: resolveVersion(),
        docs: '/api/docs',
        healthz: '/healthz',
      });
  });
}
