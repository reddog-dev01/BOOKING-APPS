import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const forwardedArgs = process.argv.slice(2);

const DEFAULT_PORT = Number.parseInt(
  process.env.WEB_DEV_DEFAULT_PORT ?? '3000',
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

const findAvailablePort = async (startingPort) => {
  let candidate = startingPort;
  const maxAttempts = 20;

  for (let attempts = 0; attempts < maxAttempts; attempts += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(candidate)) {
      return candidate;
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
    if (!(await isPortAvailable(envPort))) {
      console.error(
        `Port ${envPort} specified via environment variable is already in use. Please choose a different port.`,
      );
      process.exit(1);
    }

    spawnDevServer(envPort, 'environment variable');
    return;
  }

  const initialPort = Number.isInteger(DEFAULT_PORT) ? DEFAULT_PORT : 3000;
  const availablePort = await findAvailablePort(initialPort);
  spawnDevServer(availablePort, 'auto-detected');
};

const spawnDevServer = (port, origin) => {
  if (origin === 'auto-detected') {
    console.log(
      `Selected port ${port} for the web dev server (original preference: ${DEFAULT_PORT}).`,
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
