import cors from '@fastify/cors';
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const DEV_PORT_START = 3000;
const DEV_PORT_END = 3008;

const normalizeOrigin = (origin?: string | null): string => {
  return origin?.trim().replace(/\/$/, '').toLowerCase() ?? '';
};

const buildDevOrigins = (): string[] => {
  const origins: string[] = [];

  for (let port = DEV_PORT_START; port <= DEV_PORT_END; port += 1) {
    origins.push(`http://localhost:${port}`);
    origins.push(`http://127.0.0.1:${port}`);
  }

  return origins;
};

const buildAllowList = (): Set<string> => {
  const extras = process.env.CORS_ORIGINS?.split(',').map((value) => normalizeOrigin(value)) ?? [];
  const dev = buildDevOrigins().map((value) => normalizeOrigin(value));

  return new Set<string>([...dev, ...extras.filter(Boolean)]);
};

const isAllowed = (origin: string | undefined, allowList: Set<string>): boolean => {
  if (!origin) {
    return true; // Non-browser clients omit Origin.
  }

  return allowList.has(normalizeOrigin(origin));
};

const registerGuard = (app: FastifyInstance, allowList: Set<string>) => {
  app.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply, done) => {
    if (request.method === 'OPTIONS') {
      done();
      return;
    }

    const origin = request.headers.origin as string | undefined;
    if (!isAllowed(origin, allowList)) {
      reply
        .code(403)
        .send({ statusCode: 403, error: 'Forbidden', message: 'CORS_ORIGIN_BLOCKED' });
      return;
    }

    done();
  });
};

export default fp(async (app) => {
  const allowList = buildAllowList();

  await app.register(cors, {
    credentials: true,
    strictPreflight: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    origin(origin, callback) {
      const ok = isAllowed(origin, allowList);
      callback(null, ok); // Do not throw, Fastify treats errors as 500s.
    },
  });

  registerGuard(app, allowList);
});
