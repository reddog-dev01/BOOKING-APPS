import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = '3002';
const port = process.env.PORT ?? DEFAULT_PORT;

const __dirname = dirname(fileURLToPath(import.meta.url));
const nextBin = process.platform === 'win32'
  ? resolve(__dirname, '..', 'node_modules', '.bin', 'next.cmd')
  : resolve(__dirname, '..', 'node_modules', '.bin', 'next');

const child = spawn(
  nextBin,
  ['dev', '--turbopack', '--port', port],
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
