export function ownerReadyAllowed(request:{peer:string;host:string;origin:string;nonce:unknown;case:unknown},state:{origin:string;nonce:string;activeCase:string;stopped:boolean}){
 if(state.stopped||!['fail','cancel'].includes(state.activeCase)||!state.nonce||!state.origin)return false;
 return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.peer)&&request.host===new URL(state.origin).host&&request.origin===state.origin&&request.nonce===state.nonce&&request.case===state.activeCase;
}
