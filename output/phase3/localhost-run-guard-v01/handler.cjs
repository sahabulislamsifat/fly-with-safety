'use strict';
const {evidence}=require('../origin-routing-review/guard-evidence.cjs');
function handler(getOrigin,marker,receipts,record){return(req,res)=>{
 const guard=evidence(req,getOrigin()),id=req.headers['x-proof-id'];
 const ownId=typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id)?id:null;
 const receipt={id:ownId,guard,expectedAllowedStatus:200,returnedStatus:guard.admitted?200:404};
 receipts.push(receipt);record(receipt);
 req.resume();res.setHeader('Cache-Control','no-store');res.setHeader('x-proof-marker',marker);
 if(!guard.admitted){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; frame-ancestors 'none'"});res.end('<!doctype html><title>Synthetic callback proof</title><p>Callback received. No payment processed.</p>');
};}
module.exports={handler};
