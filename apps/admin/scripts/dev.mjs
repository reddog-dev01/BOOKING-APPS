import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = process.env.ADMIN_DEV_DEFAULT_PORT ?? '3002';
const forwardedArgs = process.argv.slice(2);

const resolvePort = () => {
  const shortFlagIndex = forwardedArgs.findIndex((arg) => arg === '-p');
  const longFlagIndex = forwardedArgs.findIndex((arg) => arg === '--port');
  const flagIndex = shortFlagIndex !== -1 ? shortFlagIndex : longFlagIndex;

  if (flagIndex !== -1) {
    const valueIndex = flagIndex + 1;
    const value = forwardedArgs[valueIndex];
    if (!value || value.startsWith('-')) {
      console.error('Expected a port number after --port/-p');
      process.exit(1);
    }
    forwardedArgs.splice(flagIndex, 2);
    return value;
  }

  const explicitEnv = process.env.ADMIN_PORT ?? process.env.ADMIN_DEV_PORT;
  if (explicitEnv?.trim()) {
    return explicitEnv.trim();
  }

  return DEFAULT_PORT;
};

const port = resolvePort();

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
  console.error('Unable to locate the Next.js binary for the admin app.');
  process.exit(1);
}

const child = spawn(
  nextBin,
  ['dev', '--turbopack', '--port', port, ...forwardedArgs],
  {
    stdio: 'inherit',
    env: { ...process.env, PORT: port },
  }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
