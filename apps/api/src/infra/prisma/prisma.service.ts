import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly displayUrl: string;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not defined');
    }

    super({ datasources: { db: { url } } });
    this.displayUrl = PrismaService.maskCredentials(url);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log(`Connected to database at ${this.displayUrl}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error when connecting to database';
      this.logger.error(
        `Failed to connect to the database (${this.displayUrl}): ${message}. Ensure Postgres is running (e.g. \`docker compose up -d db\`) and DATABASE_URL is configured.`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  private static maskCredentials(url: string): string {
    const credentialPattern = /:\/\/[\w.%+-]+:[^@]+@/;
    if (!credentialPattern.test(url)) {
      return url;
    }
    return url.replace(credentialPattern, '://***:***@');
  }
}
