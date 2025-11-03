import cors from '@fastify/cors';
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const LOCALHOST_PORT_START = 3000;
const LOCALHOST_PORT_END = 3008;

const normalizeOrigin = (origin?: string | null): string => {
  if (!origin) {
    return '';
  }

  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`
      .trim()
      .replace(/\/$/, '')
      .toLowerCase();
  } catch {
    return '';
  }
};

const buildDevOrigins = (): string[] => {
  const hosts = ['localhost', '127.0.0.1'];
  const protocols = ['http', 'https'];
  const entries: string[] = [];

  for (let port = LOCALHOST_PORT_START; port <= LOCALHOST_PORT_END; port += 1) {
    for (const host of hosts) {
      for (const protocol of protocols) {
        entries.push(`${protocol}://${host}:${port}`);
      }
    }
  }

  return entries;
};

type CorsAllowConfig = {
  allowAll: boolean;
  allowList: Set<string>;
};

const readConfiguredOrigins = (): CorsAllowConfig => {
  const allowList = new Set<string>(buildDevOrigins().map((value) => normalizeOrigin(value)));

  const extraValues = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  let allowAll = false;

  for (const value of extraValues) {
    if (value === '*') {
      allowAll = true; // Explicit wildcard configured via CORS_ORIGINS="*".
      continue;
    }

    const normalized = normalizeOrigin(value);
    if (normalized) {
      allowList.add(normalized);
    }
  }

  return { allowAll, allowList };
};

const isAllowedOrigin = (origin: string | undefined | null, config: CorsAllowConfig): boolean => {
  if (!origin) {
    return true; // Non-browser clients have no Origin header.
  }

  if (config.allowAll) {
    return true;
  }

  return config.allowList.has(normalizeOrigin(origin));
};

const registerOnRequestGuard = (app: FastifyInstance, config: CorsAllowConfig) => {
  if (config.allowAll) {
    return; // Wildcard mode mirrors Fastify's internal CORS decision.
  }

  app.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply, done) => {
    if (request.method === 'OPTIONS') {
      done();
      return;
    }

    const origin = request.headers.origin as string | undefined;
    if (!isAllowedOrigin(origin, config)) {
      app.log.warn({ origin }, 'blocked request by CORS policy');
      reply
        .code(403)
        .header('Vary', 'Origin')
        .send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'CORS_ORIGIN_BLOCKED',
        });
      return;
    }

    done();
  });
};

export default fp(async (app) => {
  const allowConfig = readConfiguredOrigins();
  app.log.debug(
    {
      wildcard: allowConfig.allowAll,
      origins: Array.from(allowConfig.allowList.values()),
    },
    'configured CORS allow-list',
  );

  await app.register(cors, {
    credentials: true, // Allow cookies/headers in dev environments.
    strictPreflight: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    origin(origin, callback) {
      const allowed = isAllowedOrigin(origin, allowConfig);
      callback(null, allowed);
    },
  });

  registerOnRequestGuard(app, allowConfig);
});
