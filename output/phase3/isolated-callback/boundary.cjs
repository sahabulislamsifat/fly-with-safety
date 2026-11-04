'use strict';
const paths = Object.freeze(['success','fail','cancel','ipn'].map(x=>'/api/v1/payments/sslcommerz/'+x));
function allowed(req) {
 return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress) &&
  req.headers.host==='phase3-callback.invalid' && req.method==='POST' && paths.includes(req.url) &&
  /^application\/x-www-form-urlencoded(?:\s*;.*)?$/i.test(req.headers['content-type']||'') &&
  !req.headers['transfer-encoding'] && /^(0|[1-9][0-9]{0,4})$/.test(req.headers['content-length']||'') && Number(req.headers['content-length'])<=16384;
}
function boundary(req,res,next){if(allowed(req))return next();res.statusCode=404;res.setHeader('Cache-Control','no-store');res.end();}
function assertTarget(value){
 let u;try{u=new URL(value);}catch{throw Error('LOCAL_TARGET_REQUIRED');}
 if(u.protocol!=='postgresql:'||u.hostname!=='127.0.0.1'||u.port!=='5432'||u.pathname!=='/flywithsafety_local_integration'||u.username!=='flywithsafe_phase2_booking_test'||!u.password||u.search||u.hash)throw Error('LOCAL_TARGET_REQUIRED');
}
module.exports={paths,allowed,boundary,assertTarget};
