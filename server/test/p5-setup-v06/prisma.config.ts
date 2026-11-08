import { defineConfig } from 'prisma/config';
const value = process.env.P5_APPROVED_OWNER_URL || '';
const url = new URL(value);
if (process.env.P5_APPROVED_MIGRATION !== 'true' || !/^[1-9][0-9]*$/.test(process.env.P5_ACTUAL_OID || '') || process.env.P5_ACTUAL_OID === '34701' ||
  url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || url.port !== '5432' || url.pathname !== '/flywithsafety_p5_identity_scope_test' ||
  url.username !== 'fws_p5_identity_migrator' || !url.password || url.search || url.hash) throw Error('P5_APPROVED_MIGRATION_TARGET_REQUIRED');
export default defineConfig({ schema:'../../prisma/schema.prisma',migrations:{path:'../../prisma/migrations'},datasource:{url:value} });
