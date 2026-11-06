'use strict';
const {paths}=require('../isolated-callback/boundary.cjs');
const {accept}=require('../localhost-run-smoke/transport.cjs');
function evidence(req,origin){
 const host=origin?new URL(origin).host:null;
 const fields={originKnown:!!origin,loopback:['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress),methodPOST:req.method==='POST',exactCallback:paths.includes(req.url),hostMatches:!!host&&req.headers.host===host,forwardedHTTPS:req.headers['x-forwarded-proto']==='https',formContentType:/^application\/x-www-form-urlencoded(?:\s*;.*)?$/i.test(req.headers['content-type']||''),noTransferEncoding:!req.headers['transfer-encoding'],boundedDeclaredLength:/^(0|[1-9][0-9]{0,4})$/.test(req.headers['content-length']||'')&&Number(req.headers['content-length'])<=16384};
 return{...fields,admitted:accept(req,origin),failedPredicates:Object.entries(fields).filter(([,v])=>!v).map(([k])=>k)};
}
module.exports={evidence};
