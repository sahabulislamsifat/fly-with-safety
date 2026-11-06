'use strict';
const ORIGIN='https://russel-semisacred-elise.ngrok-free.dev',CALLBACK='/api/v1/payments/sslcommerz/success';
function resource(url,type){
 let u;try{u=new URL(url);}catch{return{allow:false,category:'INVALID'};}
 if(u.protocol!=='https:'||u.username||u.password)return{allow:false,category:'UNSAFE'};
 if(type==='document')return{allow:u.origin===ORIGIN&&u.pathname===CALLBACK&&!u.search,category:'DOCUMENT'};
 const staticType=['script','stylesheet','image','font'].includes(type);
 if(staticType&&u.origin===ORIGIN&&!u.search)return{allow:true,category:'SAME_ORIGIN_STATIC'};
 if(staticType&&u.origin==='https://cdn.ngrok.com'&&u.pathname.startsWith('/static/')&&!u.search)return{allow:true,category:'NGROK_CDN_STATIC'};
 return{allow:false,category:'OUT_OF_SCOPE'};
}
function structure(html){
 const s=String(html).slice(0,32768);
 return {sampleCharacters:s.length,truncated:String(html).length>32768,scripts:(s.match(/<script\b/gi)||[]).length,frames:(s.match(/<iframe\b/gi)||[]).length,forms:(s.match(/<form\b/gi)||[]).length,warning:/ERR_NGROK_6024|You are about to visit|served for free through ngrok/i.test(s),ngrokError:/ERR_NGROK_\d+/.test(s)};
}
function classify({status,html='',title='',text='',marker=false,originSeen=false,navigationError=false,renderLimited=false}){
 const h=structure(html),warning=h.warning||/ERR_NGROK_6024|You are about to visit|served for free through ngrok/i.test(String(title)+' '+String(text));
 let source=navigationError?'INCOMPLETE_NAVIGATION':marker&&originSeen?'CORRELATED_ORIGIN':warning?'NGROK_INTERSTITIAL':'UNKNOWN_INTERMEDIARY';
 return {source,html:h,title:String(title).replace(/https?:\/\/\S+|[\w.+-]+@[\w.-]+|\b[A-Za-z0-9_-]{24,}\b/g,'[redacted]').replace(/[^\p{L}\p{N}\s.,:;!?()\-]/gu,'').slice(0,160),renderLimited,
 decision:navigationError?'BLOCKED_INCOMPLETE':warning?'BLOCKED_WARNING':status===404&&!renderLimited?'GO_TO_GENUINE_POST_TEST':'BLOCKED_UNCLASSIFIED',paymentAcceptance:false};
}
async function install(page){
 const events=[];const record=e=>{if(events.length<100)events.push(e);};
 page.on('requestfailed',req=>record({event:'requestfailed',type:req.resourceType(),category:resource(req.url(),req.resourceType()).category,error:'REQUEST_FAILED'}));
 page.on('pageerror',()=>record({event:'pageerror',error:'BROWSER_SCRIPT_ERROR'}));
 page.on('console',m=>{if(m.type()==='error')record({event:'console',error:'BROWSER_CONSOLE_ERROR'});});
 await page.route('**/*',route=>{const req=route.request(),p=resource(req.url(),req.resourceType());record({event:'route',type:req.resourceType(),category:p.category,allowed:p.allow});return p.allow?route.continue():route.abort();});
 return events;
}
module.exports={resource,structure,classify,install};
