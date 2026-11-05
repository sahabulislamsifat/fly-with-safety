import {createRequire} from 'node:module';
const local=createRequire(__filename);
const {accept}=local('../../../output/phase3/localhost-run-smoke/transport.cjs');
const {inspect}=local('../../../output/phase3/localhost-run-proxy-v01/proxy-evidence.cjs');
export function financialAdmission(req:unknown,origin:string|undefined){
 const meta=inspect(req,origin);const admitted=!!origin&&accept(req,origin)&&meta.xfpRawCount===1&&meta.forwardedRawCount===1&&meta.xfpClass==='EXACT_HTTPS'&&meta.forwardedClass==='HTTPS'&&!meta.duplicateSchemeHeader&&!meta.crossHeaderConflict;
 return {admitted,meta};
}
