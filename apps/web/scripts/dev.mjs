import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const forwardedArgs = process.argv.slice(2);

const DEFAULT_PORT = Number.parseInt(
  process.env.WEB_DEV_DEFAULT_PORT ?? '3005',
  10,
);

const PORT_ENV_PRIORITY = ['WEB_DEV_PORT', 'WEB_PORT', 'PORT'];

const __dirname = dirname(fileURLToPath(import.meta.url));

const candidateBins = [
  process.platform === 'win32'
    ? resolve(__dirname, '..', 'node_modules', '.bin', 'next.cmd')
    : resolve(__dirname, '..', 'node_modules', '.bin', 'next'),
  process.platform === 'win32'
    ? resolve(__dirname, '..', '..', '..', 'node_modules', '.bin', 'next.cmd')
    : resolve(__dirname, '..', '..', '..', 'node_modules', '.bin', 'next'),
];

const nextBin = candidateBins.find((binPath) => existsSync(binPath));

if (!nextBin) {
  console.error('Unable to locate the Next.js binary for the web app.');
  process.exit(1);
}

const parsePortValue = (value, source) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    console.error(`Invalid port "${value}" from ${source}.`);
    process.exit(1);
  }
  return parsed;
};

const extractPortFromArgs = () => {
  const shortFlagIndex = forwardedArgs.findIndex((arg) => arg === '-p');
  const longFlagIndex = forwardedArgs.findIndex((arg) => arg === '--port');
  const flagIndex = shortFlagIndex !== -1 ? shortFlagIndex : longFlagIndex;

  if (flagIndex === -1) {
    return undefined;
  }

  const valueIndex = flagIndex + 1;
  const value = forwardedArgs[valueIndex];

  if (!value || value.startsWith('-')) {
    console.error('Expected a port number after --port/-p');
    process.exit(1);
  }

  forwardedArgs.splice(flagIndex, 2);
  return parsePortValue(value, 'CLI flag');
};

const getEnvPort = () => {
  for (const key of PORT_ENV_PRIORITY) {
    const value = process.env[key];
    if (value?.trim()) {
      return parsePortValue(value.trim(), `environment variable ${key}`);
    }
  }
  return undefined;
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

const RESERVED_PORT_ENV_KEYS = ['ADMIN_DEV_PORT', 'ADMIN_PORT', 'API_DEV_PORT', 'API_PORT'];
const RESERVED_PORT_DEFAULTS = [3006, 3007];

const collectReservedPorts = () => {
  const reserved = new Set(RESERVED_PORT_DEFAULTS);

  for (const key of RESERVED_PORT_ENV_KEYS) {
    const value = process.env[key];
    if (!value?.trim()) {
      continue;
    }

    reserved.add(parsePortValue(value.trim(), `environment variable ${key}`));
  }

  return reserved;
};

const findAvailablePort = async (startingPort, excludedPorts = new Set(), options = {}) => {
  const { onPortUnavailable } = options;

  const reportedBusyPorts = new Set();
  let candidate = startingPort;
  const maxAttempts = 20;

  for (let attempts = 0; attempts < maxAttempts; attempts += 1) {
    if (candidate < 1 || candidate > 65535) {
      console.error(
        `Unable to find a free port: candidate ${candidate} is outside the valid TCP port range.`,
      );
      process.exit(1);
    }
    if (excludedPorts.has(candidate)) {
      candidate += 1;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(candidate)) {
      return candidate;
    }

    if (typeof onPortUnavailable === 'function' && !reportedBusyPorts.has(candidate)) {
      onPortUnavailable(candidate);
      reportedBusyPorts.add(candidate);
    }

    candidate += 1;
  }

  console.error(
    `Unable to find a free port starting from ${startingPort}. Tried ${maxAttempts} sequential ports.`,
  );
  process.exit(1);
};

const run = async () => {
  const cliPort = extractPortFromArgs();
  if (cliPort) {
    if (!(await isPortAvailable(cliPort))) {
      console.error(
        `Port ${cliPort} specified via CLI flag is already in use. Please choose a different port.`,
      );
      process.exit(1);
    }

    spawnDevServer(cliPort, 'CLI flag');
    return;
  }

  const envPort = getEnvPort();
  if (envPort) {
    if (await isPortAvailable(envPort)) {
      spawnDevServer(envPort, 'environment variable');
      return;
    }

    console.warn(
      `Port ${envPort} specified via environment variable is already in use. Falling back to an auto-detected port.`,
    );

    const fallbackStart = envPort >= 65535 ? 1 : envPort + 1;
    const fallbackPort = await findAvailablePort(fallbackStart, collectReservedPorts());
    spawnDevServer(fallbackPort, 'auto-detected', envPort);
    return;
  }

  const initialPort = Number.isInteger(DEFAULT_PORT) ? DEFAULT_PORT : 3005;
  const reservedPorts = collectReservedPorts();

  const reportBusyPort = (port) => {
    const guidance =
      port === initialPort
        ? 'The Docker web container or another Next.js dev server is probably still running.'
        : undefined;

    console.warn(
      [
        `Port ${port} is already in use.`,
        guidance,
        'Stop the conflicting process (e.g. `docker compose down`) or pass `--port <free-port>` to override.',
      ]
        .filter(Boolean)
        .join(' '),
    );
  };

  if (await isPortAvailable(initialPort)) {
    spawnDevServer(initialPort, 'default port');
    return;
  }

  reportBusyPort(initialPort);

  const fallbackCandidates = [3000].filter(
    (candidate) => candidate !== initialPort && !reservedPorts.has(candidate),
  );

  for (const candidate of fallbackCandidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(candidate)) {
      spawnDevServer(candidate, 'auto-detected', initialPort);
      return;
    }

    reportBusyPort(candidate);
  }

  const excludedPorts = new Set([...reservedPorts, initialPort, ...fallbackCandidates]);
  const fallbackStart = initialPort >= 65535 ? 1 : initialPort + 1;
  const availablePort = await findAvailablePort(fallbackStart, excludedPorts, {
    onPortUnavailable: reportBusyPort,
  });
  spawnDevServer(availablePort, 'auto-detected', initialPort);
};

const spawnDevServer = (port, origin, preferredPort = DEFAULT_PORT) => {
  if (origin === 'auto-detected') {
    console.log(
      `Selected port ${port} for the web dev server (original preference: ${preferredPort}).`,
    );
  } else {
    console.log(`Using port ${port} from ${origin}.`);
  }

  const child = spawn(
    nextBin,
    ['dev', '--port', String(port), ...forwardedArgs],
    {
      stdio: 'inherit',
      env: { ...process.env, PORT: String(port) },
    },
  );

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
