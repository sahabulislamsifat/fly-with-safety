export type Procedure={status:string;source:string|null;reviewedReference:string|null;fail:{instruction:string|null;requireIPN:boolean;method:string|null};cancel:{instruction:string|null;requireIPN:boolean;method:string|null}};
export function requireSupportedActions(p:Procedure){
 if(p.status!=='CONFIRMED_OFFICIAL_SUPPORT'||!p.source||!p.reviewedReference)throw Error('SUPPORT_PROCEDURE_NOT_CONFIRMED');
 const u=new URL(p.source);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||!(u.hostname==='sslcommerz.com'||u.hostname.endsWith('.sslcommerz.com')||u.hostname==='github.com'&&u.pathname.startsWith('/sslcommerz/')))throw Error('OFFICIAL_PROCEDURE_SOURCE_REQUIRED');
 for(const c of ['fail','cancel'] as const){const v=p[c];if(v.method!=='POST')throw Error('CALLBACK_POST_CONTRACT_REQUIRED');if(typeof v.instruction!=='string'||v.instruction.length<10||v.instruction.length>800||typeof v.requireIPN!=='boolean'||/\b\d{12,19}\b|store_pass|sessionkey|https?:\/\//i.test(v.instruction))throw Error('SAFE_NEGATIVE_INSTRUCTIONS_REQUIRED');}
 return p;
}
