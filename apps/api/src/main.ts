import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const adapter = new FastifyAdapter({
    logger: true,      // Pino JSON
    trustProxy: true,  // chạy sau Caddy/Nginx/Cloud
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);

  await configureApp(app);
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
