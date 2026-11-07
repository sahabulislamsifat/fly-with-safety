'use strict';
const fs=require('node:fs'),path=require('node:path');
const {safeDiagnostic}=require('./output-contract.cjs');
const allowed=new Set(['TARGET_GUARD_PASS','PRISMA_CLIENT_CREATED','DATABASE_IDENTITY_VERIFIED','MIGRATIONS_VERIFIED','INITIAL_EMPTY_VERIFIED','TRANSACTION_ENTERED','USERS_INSERTED','SESSION_CREATED','BOOKING_CREATED','PRINCIPAL_LOAD_STARTED','PRINCIPAL_LOADED','UNASSIGNED_CHECK_STARTED','TRANSACTION_ERROR','UNASSIGNED_DENIED','ASSIGNED_ADMITTED','AUDIT_INSERTED','AUDIT_UPDATE_REJECTED','SESSION_INVALIDATED','ROLLBACK_CONFIRMED','FINAL_EMPTY_VERIFIED','TEST_ERROR','CLIENT_DISCONNECTED']);
const file=path.resolve(__dirname,'../../../output/phase5/p5-integration-20261108-01/test-journal.jsonl');
function record(stage,error){
  if(!allowed.has(stage))throw Error('JOURNAL_STAGE_REJECTED');
  // Directory is created exclusively by the owner-approved parent before starting Vitest.
  fs.appendFileSync(file,JSON.stringify({utc:new Date().toISOString(),stage,...(error?safeDiagnostic(error):{})})+'\n');
}
function recordPredicates(row){
  const evidence={rowPresent:row!==null};
  if(row){
    for(const key of ['notRevoked','unexpired','unexpiredUsingUtc','versionsMatch','mfaVersionsMatch','notSuspended','staffRole','emailVerified']){
      if(typeof row[key]!=='boolean')throw Error('PREDICATE_EVIDENCE_SHAPE');evidence[key]=row[key];
    }
    evidence.databaseTimeZone=/^[A-Za-z0-9_+:/.-]{1,64}$/.test(row.databaseTimeZone)?row.databaseTimeZone:'UNCLASSIFIED';
  }
  fs.appendFileSync(file,JSON.stringify({utc:new Date().toISOString(),stage:'READ_ONLY_AUTH_PREDICATES',diagnosticOnly:true,...evidence})+'\n');
}
module.exports={record,recordPredicates};
