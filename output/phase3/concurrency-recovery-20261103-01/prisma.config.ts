import { defineConfig } from '../../../server/node_modules/prisma/config';
export default defineConfig({
  schema: 'E:/Programming/Project/fly-with-safety/server/prisma/schema.prisma',
  datasource: { url: 'postgresql://synthetic:synthetic@127.0.0.1:5432/flywithsafety_local_integration' },
});
