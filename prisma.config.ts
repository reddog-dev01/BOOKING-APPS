/// <reference types="node" />
import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join('packages', 'db', 'prisma', 'schema.prisma'),
});
