import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

const LOCALHOST_PORT_START = 3000;
const LOCALHOST_PORT_END = 3008;

const LOCALHOST_HOSTS = ['localhost', '127.0.0.1'];
const LOCALHOST_PROTOCOLS = ['http', 'https'];

const normalizeOrigin = (origin: string | undefined): string | undefined => {
  if (!origin) {
    return undefined;
  }
  try {
    const url = new URL(origin);
    const protocol = url.protocol.toLowerCase();
    const hostname = url.hostname.toLowerCase();
    // Preserve explicit ports; browsers omit default ports for http/https.
    const port = url.port ? `:${url.port}` : '';
    return `${protocol}//${hostname}${port}`;
  } catch {
    return undefined;
  }
};

const buildLocalhostMatrix = (): Set<string> => {
  const matrix = new Set<string>();
  for (let port = LOCALHOST_PORT_START; port <= LOCALHOST_PORT_END; port += 1) {
    for (const protocol of LOCALHOST_PROTOCOLS) {
      for (const host of LOCALHOST_HOSTS) {
        matrix.add(`${protocol}://${host}:${port}`);
      }
    }
  }
  return matrix;
};

const parseCsv = (input: string | undefined): string[] => {
  if (!input) {
    return [];
  }
  return input
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
};

const readAllowedOrigins = () => {
  const defaults = buildLocalhostMatrix();
  const envValue = process.env.CORS_ORIGINS?.trim();
  if (!envValue) {
    return { wildcard: false, origins: defaults };
  }
  if (envValue === '*') {
    return { wildcard: true, origins: new Set<string>() };
  }

  const origins = new Set(defaults);
  for (const candidate of parseCsv(envValue)) {
    const normalized = normalizeOrigin(candidate);
    if (normalized) {
      origins.add(normalized);
    }
  }
  return { wildcard: false, origins };
};

export const corsPlugin = fp(async (fastify: FastifyInstance) => {
  const { wildcard, origins } = readAllowedOrigins();

  const evaluateOrigin = (requestOrigin: string | undefined) => {
    if (!requestOrigin) {
      return { allowed: true } as const;
    }

    if (wildcard) {
      return {
        allowed: true,
        reflect: requestOrigin,
        normalized: normalizeOrigin(requestOrigin),
      } as const;
    }

    const normalized = normalizeOrigin(requestOrigin);
    if (normalized && origins.has(normalized)) {
      return {
        allowed: true,
        reflect: requestOrigin,
        normalized,
      } as const;
    }

    return { allowed: false, normalized } as const;
  };

  await fastify.register(cors, {
    credentials: true, // Required so browsers send cookies/headers in dev.
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    preflight: true,
    strictPreflight: true,
    origin: (requestOrigin, callback) => {
      const result = evaluateOrigin(requestOrigin);

      if (!requestOrigin) {
        callback(null, true);
        return;
      }

      if (result.allowed && result.reflect) {
        callback(null, result.reflect);
        return;
      }

      fastify.log.warn({ origin: requestOrigin, normalized: result.normalized }, 'blocked CORS origin');
      callback(null, false); // Deny CORS preflight cleanly (Fastify replies 403/400 without throwing).
    },
  });

  // Block disallowed origins early so actual handlers don't run for rejected callers.
  fastify.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (!origin) {
      return;
    }

    const result = evaluateOrigin(origin);
    if (result.allowed) {
      return;
    }

    fastify.log.warn({ origin, normalized: result.normalized }, 'blocked request by CORS policy');
    reply
      .code(403)
      .header('Content-Type', 'application/json')
      .header('Vary', 'Origin')
      .send({
        error: 'CORS_ORIGIN_BLOCKED',
        message: 'Origin is not allowed to access this resource.',
      });
    return reply;
  });
});

export default corsPlugin;
