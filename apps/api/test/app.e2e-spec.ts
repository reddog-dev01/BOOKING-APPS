import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { configureApp } from '../src/bootstrap';

describe('AppController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', async () => {
    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect(({ body, headers }) => {
        expect(headers['cache-control']).toBe('no-store');
        expect(body).toMatchObject({
          name: 'booking-api',
          docs: '/api/docs',
          healthz: '/healthz',
        });
        expect(typeof body.version).toBe('string');
      });
  });

  it('/healthz (GET)', () => {
    return request(app.getHttpServer())
      .get('/healthz')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ ok: true });
        expect(typeof body.ts).toBe('string');
      });
  });
});
