'use strict';
const kinds=new Set(['Error','AssertionError','AppError','PrismaClientKnownRequestError','PrismaClientUnknownRequestError','PrismaClientInitializationError','PrismaClientValidationError','TypeError','SyntaxError']);
const codes=new Set(['UNAUTHORIZED','FORBIDDEN','NOT_FOUND','BAD_REQUEST','CONFLICT','MFA_REQUIRED','MFA_UNAVAILABLE','IDENTITY_UNAVAILABLE']);
function locations(text){
  const found=[];
  for(const m of String(text||'').matchAll(/[\\/](server[\\/](?:src|test)[\\/][A-Za-z0-9_.\\/-]+\.(?:ts|js|cjs)):(\d+):(\d+)/g)){
    const item={file:m[1].replaceAll('\\','/'),line:Number(m[2]),column:Number(m[3])};
    if(!found.some(x=>x.file===item.file&&x.line===item.line))found.push(item);if(found.length===3)break;
  }
  return found;
}
function knownError(error){
  const fields={},seen=new Set(),frames=[];
  function visit(value,depth){
    if(!value||typeof value!=='object'||depth>5||seen.has(value))return;seen.add(value);
    if(kinds.has(value.name)&&!fields.errorKind)fields.errorKind=value.name;
    if(codes.has(value.code)&&!fields.applicationCode)fields.applicationCode=value.code;
    if(Number.isInteger(value.statusCode)&&value.statusCode>=100&&value.statusCode<=599&&!fields.httpStatus)fields.httpStatus=value.statusCode;
    if(typeof value.stack==='string')frames.push(...locations(value.stack));
    for(const key of ['actual','cause','meta','driverAdapterError'])visit(value[key],depth+1);
  }
  visit(error,0);if(frames.length)fields.sourceLocations=frames.slice(0,3);return fields;
}
function assertions(report){
  const result=[];
  for(const file of Array.isArray(report.testResults)?report.testResults:[])for(const item of Array.isArray(file.assertionResults)?file.assertionResults:[]){
    if(item.status!=='failed')continue;
    const text=(Array.isArray(item.failureMessages)?item.failureMessages:[]).filter(x=>typeof x==='string').join('\n');
    result.push({test:item.title==='checks real scope, revocation, audit immutability and rollback'?'checks real scope, revocation, audit immutability and rollback':'UNRECOGNIZED_TEST_NAME',status:'failed',sourceLocations:locations(text),assertionError:/\bAssertionError\b/.test(text),mentionedPrismaCodes:[...new Set(text.match(/\bP[0-9]{4}\b/g)||[])].slice(0,3)});
    if(result.length===5)return result;
  }
  return result;
}
module.exports={knownError,assertions,locations};
