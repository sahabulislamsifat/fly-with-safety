'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict');
const {safeDiagnostic,parseSummary}=require('./output-contract.cjs');
test('rollback assertion preserves nested actual AppError code/status and location only',()=>{
  const actual={name:'AppError',code:'UNAUTHORIZED',statusCode:401,message:'private fixture and password',stack:'Error: private\n at fn (E:/Programming/Project/fly-with-safety/server/src/identity/auth.ts:25:10)'};
  const result=safeDiagnostic({name:'AssertionError',actual,message:'private wrapper'});
  assert.equal(result.errorKind,'AssertionError');assert.equal(result.applicationCode,'UNAUTHORIZED');assert.equal(result.httpStatus,401);
  assert.deepEqual(result.sourceLocations,[{file:'server/src/identity/auth.ts',line:25,column:10}]);assert(!JSON.stringify(result).includes('private'));
});
test('nested actual Prisma adapter error codes survive the rollback matcher',()=>assert.equal(safeDiagnostic({name:'AssertionError',actual:{code:'P2010',meta:{driverAdapterError:{cause:{originalCode:'42501'}}}}}).sqlState,'42501'));
test('report assertion locations are persisted without raw failure text or test-supplied secrets',()=>{
  const r=parseSummary(JSON.stringify({numPassedTests:0,numFailedTests:1,numPendingTests:0,numTotalTests:1,success:false,testResults:[{assertionResults:[{title:'checks real scope, revocation, audit immutability and rollback',status:'failed',failureMessages:['AssertionError private secret\n at test (E:/Programming/Project/fly-with-safety/server/test/p5-integration-v03/postgres.test.ts:60:8)']}]}]}),1);
  assert.equal(r.failedAssertions[0].sourceLocations[0].line,60);assert(!JSON.stringify(r).includes('private'));assert(!JSON.stringify(r).includes('secret'));
});
