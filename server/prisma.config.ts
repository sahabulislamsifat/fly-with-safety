import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Prisma CLI must bypass the application pooler for migration commands.
    // The Express runtime separately uses DATABASE_URL in src/lib/prisma.ts.
    url: env('DIRECT_URL'),
  },
});
