// No connection, output, hash or serialization of credentials. Same private input for native psql and Prisma/pg.
const path=require('node:path'), local=require('node:module').createRequire(path.resolve(__dirname,'../../../server/package.json'));
const {Client}=local('pg');let passed=false;
try {
 const password=process.env.PGPASSWORD,input=process.env.DATABASE_URL;
 if(!password||!input||process.env.DIRECT_URL!==input)throw Error();
 const u=new URL(input),client=new Client({connectionString:input}),p=client.connectionParameters;
 passed=u.protocol==='postgresql:'&&u.hostname==='127.0.0.1'&&u.port==='5432'&&u.pathname==='/flywithsafety_local_integration'&&u.username==='flywithsafe_phase2_booking_test'&&!u.search&&!u.hash&&p.password===password&&p.user==='flywithsafe_phase2_booking_test'&&p.database==='flywithsafety_local_integration'&&p.host==='127.0.0.1'&&p.port===5432;
}catch{passed=false}
console.log(passed?'PHASE3_PRIVATE_URL_EQUIVALENCE_PASS':'PHASE3_PRIVATE_URL_EQUIVALENCE_STOP');if(!passed)process.exitCode=1;
