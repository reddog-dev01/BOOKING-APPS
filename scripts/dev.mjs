import concurrently from 'concurrently';

const webPort = process.env.WEB_DEV_PORT ?? process.env.WEB_PORT ?? '3005';
const adminPort = process.env.ADMIN_DEV_PORT ?? process.env.ADMIN_PORT ?? '3007';
const apiPort = process.env.API_DEV_PORT ?? process.env.API_PORT ?? '3006';

const commands = [
  {
    command: 'pnpm --filter admin dev',
    name: 'admin',
    prefixColor: 'magenta',
    env: {
      ...process.env,
      ADMIN_DEV_PORT: adminPort,
      ADMIN_PORT: adminPort,
      PORT: adminPort,
    },
  },
  {
    command: 'pnpm --filter web dev',
    name: 'web',
    prefixColor: 'green',
    env: {
      ...process.env,
      WEB_DEV_PORT: webPort,
      WEB_PORT: webPort,
      PORT: webPort,
    },
  },
  {
    command: 'pnpm --filter api dev',
    name: 'api',
    prefixColor: 'cyan',
    env: {
      ...process.env,
      PORT: apiPort,
    },
  },
];

concurrently(commands, {
  killOthersOn: ['failure', 'success'],
  restartTries: 0,
}).result.catch((error) => {
  console.error(error);
  process.exit(1);
});
