const path = require('node:path');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '../../..');
const localRequire = createRequire(path.join(root, 'server/package.json'));
const {defineConfig} = localRequire('prisma/config');
module.exports = defineConfig({schema:path.join(root,'server/prisma/schema.prisma'),
  migrations:{path:path.join(root,'server/prisma/migrations')},datasource:{url:process.env.DIRECT_URL || ''}});
