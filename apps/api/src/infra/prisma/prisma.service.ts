import { existsSync, readFileSync } from 'node:fs';

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
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

    const { resolvedUrl, displayUrl } = PrismaService.resolveDatabaseUrl(url);
    super({ datasources: { db: { url: resolvedUrl } } });
    this.displayUrl = displayUrl;
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

  private static resolveDatabaseUrl(url: string): {
    resolvedUrl: string;
    displayUrl: string;
  } {
    try {
      const parsed = new URL(url);
      const insideContainer = PrismaService.isRunningInsideContainer();

      if (parsed.hostname === 'db' && !insideContainer) {
        parsed.hostname = 'localhost';
      } else if (
        PrismaService.isLocalHostname(parsed.hostname) &&
        insideContainer
      ) {
        parsed.hostname = 'db';
      }

      const sanitized = PrismaService.sanitiseUrl(parsed);
      return { resolvedUrl: parsed.toString(), displayUrl: sanitized };
    } catch (error) {
      const displayUrl = PrismaService.maskCredentials(url);
      return { resolvedUrl: url, displayUrl };
    }
  }

  private static sanitiseUrl(parsed: URL): string {
    const clone = new URL(parsed.toString());
    if (clone.username || clone.password) {
      clone.username = '***';
      clone.password = '***';
    }
    return clone.toString();
  }

  private static maskCredentials(url: string): string {
    const credentialPattern = /:\/\/[\w.%+-]+:[^@]+@/;
    if (!credentialPattern.test(url)) {
      return url;
    }
    return url.replace(credentialPattern, '://***:***@');
  }

  private static isLocalHostname(hostname: string): boolean {
    return hostname === 'localhost' || hostname === '127.0.0.1';
  }

  private static isRunningInsideContainer(): boolean {
    if (existsSync('/.dockerenv')) {
      return true;
    }

    try {
      const cgroup = readFileSync('/proc/1/cgroup', 'utf8');
      return cgroup.includes('docker') || cgroup.includes('kubepods');
    } catch (error) {
      return false;
    }
  }
}
