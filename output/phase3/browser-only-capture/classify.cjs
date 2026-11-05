'use strict';
function classify(title,text){
 const s=String(title)+'\n'+String(text);
 return {warning:/ERR_NGROK_6024|You are about to visit|served for free through ngrok/i.test(s),ngrokError:/ERR_NGROK_\d+/i.test(s),browserError:/ERR_(?:CERT|NAME_NOT_RESOLVED|CONNECTION|TUNNEL)/i.test(s),ngrokMention:/ngrok/i.test(s),title:String(title).replace(/https?:\/\/\S+|\b[A-Za-z0-9_-]{24,}\b|[\w.+-]+@[\w.-]+/g,'[redacted]').replace(/[^\p{L}\p{N}\s.,:;!?()\-]/gu,'').slice(0,160)};
}
function decision(status,c,mainOriginReached){
 if(c.warning||c.ngrokError||c.browserError)return 'BLOCKED';
 if(status===404)return 'GO_TO_PROVIDER_POST_RETURN_TEST';
 return 'BLOCKED_UNCLASSIFIED_RESPONSE';
}
module.exports={classify,decision};
