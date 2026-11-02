const fs = require('node:fs');
// Example files only; never read actual credentials or print any configured value.
for (const file of ['server/.env.example', 'client/.env.example']) {
  const names = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(line => /^[A-Z_]*(PASSWORD|SECRET|TOKEN|PRIVATE_KEY)[A-Z_]*=/.test(line) && !/(?:MAX_AGE_MS|EXPIRES_DAYS)=/.test(line)).filter(line => {
    const value = line.slice(line.indexOf('=') + 1).trim();
    return value && !/placeholder|example|change|your|replace|development|test|^['"]{2}$/i.test(value);
  }).map(line => line.split('=')[0]);
  console.log(JSON.stringify({ file, unreviewedNonemptySecretFields: names }));
}
