import concurrently from 'concurrently';
import { createServer } from 'node:net';

const SERVICES = [
  {
    name: 'web',
    command: 'pnpm --filter web dev',
    prefixColor: 'green',
    defaultPort: 3005,
    envKeys: ['WEB_DEV_PORT', 'WEB_PORT'],
    reservedDefaults: [3006, 3007],
  },
  {
    name: 'api',
    command: 'pnpm --filter api dev',
    prefixColor: 'cyan',
    defaultPort: 3006,
    envKeys: ['API_DEV_PORT', 'API_PORT'],
    reservedDefaults: [3005, 3007],
  },
  {
    name: 'admin',
    command: 'pnpm --filter admin dev',
    prefixColor: 'magenta',
    defaultPort: 3007,
    envKeys: ['ADMIN_DEV_PORT', 'ADMIN_PORT'],
    reservedDefaults: [3005, 3006],
  },
];

const parsePortValue = (value, source) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid port "${value}" from ${source}.`);
  }
  return parsed;
};

const isPortAvailable = (port) =>
  new Promise((resolvePromise, rejectPromise) => {
    const server = createServer();

    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
        resolvePromise(false);
        return;
      }

      rejectPromise(error);
    });

    server.once('listening', () => {
      server.close(() => resolvePromise(true));
    });

    server.listen({ port, host: '0.0.0.0' });
  });

const findAvailablePort = async (startingPort, excludedPorts) => {
  let candidate = startingPort;
  const maxAttempts = 1000;

  for (let attempts = 0; attempts < maxAttempts; attempts += 1) {
    if (candidate > 65535) {
      candidate = 1;
    }

    if (excludedPorts.has(candidate)) {
      candidate += 1;
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(candidate)) {
      return candidate;
    }

    candidate += 1;
  }

  throw new Error(
    `Unable to find a free port starting from ${startingPort}. Tried ${maxAttempts} sequential ports.`,
  );
};

const resolveEnvPorts = () => {
  const result = new Map();

  for (const service of SERVICES) {
    for (const key of service.envKeys) {
      const value = process.env[key];
      if (!value?.trim()) {
        continue;
      }

      const port = parsePortValue(value.trim(), `environment variable ${key}`);
      result.set(service.name, { port, key });
      break;
    }
  }

  return result;
};

const logAssignment = (serviceName, port, origin, preferredPort) => {
  if (origin === 'auto-detected') {
    console.log(
      `Selected port ${port} for the ${serviceName} dev server (original preference: ${preferredPort}).`,
    );
    return;
  }

  console.log(`Using port ${port} for the ${serviceName} dev server from ${origin}.`);
};

const assignPorts = async () => {
  const envOverrides = resolveEnvPorts();
  const occupiedPorts = new Set();
  const assignments = [];

  for (const service of SERVICES) {
    const override = envOverrides.get(service.name);
    const excluded = new Set(service.reservedDefaults);

    for (const occupied of occupiedPorts) {
      excluded.add(occupied);
    }

    for (const [otherName, otherOverride] of envOverrides.entries()) {
      if (otherName !== service.name && otherOverride) {
        excluded.add(otherOverride.port);
      }
    }

    let chosenPort;
    let origin = 'default port';

    if (override) {
      if (excluded.has(override.port)) {
        console.warn(
          `Port ${override.port} from ${override.key} is reserved by another service. Searching for a fallback.`,
        );
      } else if (await isPortAvailable(override.port)) {
        chosenPort = override.port;
        origin = `environment variable ${override.key}`;
      } else {
        console.warn(
          `Port ${override.port} from ${override.key} is already in use. Searching for a fallback.`,
        );
      }
    }

    if (!chosenPort) {
      if (!excluded.has(service.defaultPort) && (await isPortAvailable(service.defaultPort))) {
        chosenPort = service.defaultPort;
      }
    }

    if (!chosenPort) {
      const fallbackStart = override ? override.port + 1 : service.defaultPort + 1;
      chosenPort = await findAvailablePort(fallbackStart, excluded);
      origin = 'auto-detected';
    }

    occupiedPorts.add(chosenPort);
    assignments.push({
      service,
      port: chosenPort,
      origin,
      preferredPort: override?.port ?? service.defaultPort,
    });
  }

  return assignments;
};

const run = async () => {
  const assignments = await assignPorts();

  const sharedEnv = { ...process.env };

  for (const { service, port, origin, preferredPort } of assignments) {
    for (const key of service.envKeys) {
      sharedEnv[key] = String(port);
    }
    logAssignment(service.name, port, origin, preferredPort);
  }

  const commands = assignments.map(({ service, port }) => ({
    command: service.command,
    name: service.name,
    prefixColor: service.prefixColor,
    env: {
      ...sharedEnv,
      PORT: String(port),
    },
  }));

  concurrently(commands, {
    killOthersOn: ['failure', 'success'],
    restartTries: 0,
  }).result.catch((error) => {
    console.error(error);
    process.exit(1);
  });
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
