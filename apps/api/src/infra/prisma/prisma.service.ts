import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.connectWithRetry();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  private async connectWithRetry(): Promise<void> {
    const maxAttempts = Number.parseInt(process.env.PRISMA_INIT_MAX_RETRIES ?? '5', 10);
    const backoffMs = Number.parseInt(process.env.PRISMA_INIT_BACKOFF_MS ?? '3000', 10);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.$connect();
        if (attempt > 1) {
          this.logger.warn(`Connected to database after ${attempt} attempts.`);
        }
        return;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error when connecting to database';
        this.logger.error(
          `Database connection attempt ${attempt} of ${maxAttempts} failed: ${message}`,
          error instanceof Error ? error.stack : undefined,
        );

        if (attempt === maxAttempts) {
          this.logger.error(
            'Unable to connect to the database. Ensure Postgres is running (e.g. `docker compose up -d db`) and DATABASE_URL is set correctly.',
          );
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }
}
