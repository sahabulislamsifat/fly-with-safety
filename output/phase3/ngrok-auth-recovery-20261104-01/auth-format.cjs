'use strict';
// Diagnostic only, not a vendor token validator. Return no token, length or hash.
function flags(value){return{
 leadingOrTrailingWhitespace:value.trim()!==value,
 embeddedWhitespace:/\s/.test(value),
 nonAsciiOrControl:/[^\x21-\x7e]/.test(value),
 literalWrapperQuotes:value.length>=2&&((value[0]==='"'&&value.at(-1)==='"')||(value[0]==="'"&&value.at(-1)==="'")),
 commandText:/^\s*ngrok\s/i.test(value),
 urlInsteadOfToken:/^\s*https?:\/\//i.test(value),
 recognizedPlaceholder:/^(?:<[^\r\n]*>|YOUR[_ -]?(?:AUTHTOKEN|TOKEN)|TOKEN|REPLACE[_ -]?ME)$/i.test(value),
 empty:value.length===0
};}
function inspectText(text){
 const matches=[...text.matchAll(/^([ \t]*)authtoken\s*:\s*(.*?)\s*$/gm)];
 const result={supportedGeneratedShape:false,singleTokenKey:matches.length===1,source:null,scalarDecoded:false,format:null,tokenTypeVerified:false,accountAuthenticationVerified:false};
 if(matches.length!==1)return result;
 const m=matches[0];result.source=m[1].length?'agent.authtoken':'authtoken';
 if(m[1].includes('\t')||!/^version:\s*(?:[23]|"[23]"|'[23]')\s*$/m.test(text)||m[1].length&&!/^agent:\s*$/m.test(text))return result;
 let v=m[2];
 if(v.startsWith('"')){try{v=JSON.parse(v);if(typeof v!=='string')return result;}catch{return result;}}
 else if(v.startsWith("'")){if(!v.endsWith("'"))return result;v=v.slice(1,-1).replaceAll("''","'");}
 else{if(/[|>&*!{}\[\]]/.test(v)||/\s#/.test(v))return result;}
 result.supportedGeneratedShape=true;result.scalarDecoded=true;result.format=flags(v);return result;
}
module.exports={flags,inspectText};
