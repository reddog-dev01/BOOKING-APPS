import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error when connecting to database';
      this.logger.error(
        `Failed to connect to the database: ${message}. Ensure Postgres is running (e.g. \`docker compose up -d db\`) and DATABASE_URL is configured.`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
