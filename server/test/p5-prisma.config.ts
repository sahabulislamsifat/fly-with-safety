import { defineConfig } from 'prisma/config';

// Offline datamodel diff/validation only. No environment or database discovery.
export default defineConfig({ schema: '../prisma/schema.prisma',
  datasource: { url: 'postgresql://unused:unused@127.0.0.1:1/flywithsafety_p5_disposable_offline' } });
