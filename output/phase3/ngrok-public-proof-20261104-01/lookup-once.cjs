'use strict';
const dns = require('node:dns');
const host = process.argv[2];
if (process.argv.length !== 3 || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/.test(host || '') || host.split('.')[0].length > 63) process.exit(1);
dns.lookup(host, { all: true }, (error, answers) => {
  const code = ['ENOTFOUND','EAI_AGAIN','ENODATA','ETIMEOUT'].includes(error?.code) ? error.code : 'DNS_LOOKUP_CHILD_FAILED';
  console.log(JSON.stringify(error ? { success: false, code } : { success: answers.length > 0, answers: answers.length, families: [...new Set(answers.map(a => a.family))] }));
});
