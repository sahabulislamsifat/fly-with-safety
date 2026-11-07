'use strict';
const {knownError,assertions}=require('./failure-evidence.cjs');
function fail(guard){throw Object.assign(Error(guard),{guard});}
function parseSummary(text,exitCode){
  let r;try{r=JSON.parse(text);}catch{fail('TEST_STDOUT_NOT_JSON');}
  if(!r||typeof r!=='object'||Array.isArray(r))fail('TEST_REPORT_SHAPE');
  for(const key of ['numPassedTests','numFailedTests','numPendingTests','numTotalTests'])if(!Number.isSafeInteger(r[key])||r[key]<0)fail('TEST_REPORT_COUNTS');
  const todo=r.numTodoTests??0;
  if(!Number.isSafeInteger(todo)||todo<0||typeof r.success!=='boolean'||r.numPassedTests+r.numFailedTests+r.numPendingTests+todo!==r.numTotalTests)fail('TEST_REPORT_COUNTS');
  if(exitCode!==null&&!Number.isInteger(exitCode))fail('TEST_EXIT_CONTRACT');
  return {exitCode,passed:r.numPassedTests,failed:r.numFailedTests,skipped:r.numPendingTests,todo,total:r.numTotalTests,success:r.success,failedAssertions:assertions(r)};
}
function safeDiagnostic(error){
  const found={prismaCode:null,sqlState:null,nativeCode:null};
  const seen=new Set();
  function visit(value,depth){
    if(!value||typeof value!=='object'||depth>5||seen.has(value))return;seen.add(value);
    for(const name of ['code','originalCode','sqlState']){
      const code=value[name];if(typeof code!=='string')continue;
      if(/^P[0-9]{4}$/.test(code))found.prismaCode=code;
      else if(/^[0-9A-Z]{5}$/.test(code))found.sqlState=code;
      else if(['ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENOENT','EACCES','EPERM'].includes(code))found.nativeCode=code;
    }
    for(const name of ['actual','cause','meta','driverAdapterError'])visit(value[name],depth+1);
  }
  visit(error,0);return {...found,...knownError(error)};
}
function streamDiagnostic(text){return {
  jsonReportNotice:/JSON report written to /.test(text),
  syntaxError:/\bSyntaxError\b/.test(text),
  moduleNotFound:/\b(?:ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND)\b/.test(text),
  permissionDenied:/\b(?:EACCES|EPERM)\b/.test(text),
};}
function requireComplete(summary){
  if(!(summary.exitCode===0&&summary.success===true&&summary.total===1&&summary.passed===1&&summary.failed===0&&summary.skipped===0&&summary.todo===0))fail('POSTGRES_TEST_NOT_PASS');
}
module.exports={parseSummary,safeDiagnostic,streamDiagnostic,requireComplete};
