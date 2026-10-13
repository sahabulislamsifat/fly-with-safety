import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url:
      (
        globalThis as typeof globalThis & {
          process?: { env?: Record<string, string | undefined> };
        }
      ).process?.env?.DIRECT_URL ?? '',
  },
});
