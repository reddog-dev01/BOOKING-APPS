import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { RequestMethod, ValidationPipe } from '@nestjs/common';

// Fastify v5 plugins (đã đồng bộ major)
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';

async function bootstrap() {
  const adapter = new FastifyAdapter({
    logger: true,      // Pino JSON
    trustProxy: true,  // chạy sau Caddy/Nginx/Cloud
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'healthz', method: RequestMethod.GET },
    ],
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      const allow = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
        .split(',').map(s => s.trim()).filter(Boolean);
      if (!origin || allow.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(compress, {}); // gzip/br/zstd (zstd cần Node >=22.15)
  await app.register(rateLimit, {
    max: Number(process.env.RL_MAX ?? 120),
    timeWindow: process.env.RL_WINDOW ?? '1 minute',
    ban: Number(process.env.RL_BAN ?? 0),
    keyGenerator: (req) => String(req.headers['x-forwarded-for'] ?? req.ip),
    addHeadersOnExceeding: { 'x-ratelimit-remaining': true },
    addHeaders: { 'x-ratelimit-limit': true, 'x-ratelimit-remaining': true, 'retry-after': true },
    allowList: (req) => {
      const ip = String(req.headers['x-forwarded-for'] ?? req.ip).split(',')[0].trim();
      const wl = (process.env.RL_ALLOWLIST ?? '').split(',').map(s => s.trim()).filter(Boolean);
      return wl.includes(ip);
    },
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
