const fs = require('node:fs'), path = require('node:path'), { createRequire } = require('node:module');
const local = createRequire(path.resolve(__dirname, '../../server/package.json'));
// Configuration metadata only; never connect, print credentials or return a URL.
for (const file of ['server/.env','client/.env','client/.env.local']) {
  if (!fs.existsSync(file)) continue;
  const env = local('dotenv').parse(fs.readFileSync(file));
  const out = {file, configurationOnly:true};
  if(file.startsWith('server/')) {
    for(const key of ['DATABASE_URL','DIRECT_URL']) {
      try {const u=new URL(env[key]);out[key]={present:true,localHost:u.hostname==='127.0.0.1'||u.hostname==='localhost',exactPhase2:u.hostname==='127.0.0.1'&&u.port==='5432'&&u.pathname==='/flywithsafe_phase2_booking_integration'&&u.username==='flywithsafe_phase2_booking_test'};}
      catch {out[key]={present:!!env[key],valid:false};}
    }
  } else {
    for(const key of ['NEXT_PUBLIC_LOCAL_API_BASE_URL','NEXT_PUBLIC_API_BASE_URL','NEXT_BASE_API_URL']) {
      out[key]={present:!!env[key],exactLocal5000:env[key]==='http://localhost:5000/api/v1'};
    }
  }
  console.log(JSON.stringify(out));
}
