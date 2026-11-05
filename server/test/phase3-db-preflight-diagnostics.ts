import {errorDataField as field} from '../src/utils/error-fields.js';
import {paymentProofFailure} from './phase3-proof-diagnostics.js';
export function preflightFailure(error:unknown,operation:string){
 const visited=new Set<unknown>(),nodes:unknown[]=[];
 function walk(e:unknown,depth=0){if(depth>5||visited.has(e)||!e||typeof e!=='object')return;visited.add(e);nodes.push(e);for(const k of ['meta','cause','driverAdapterError'])walk(field(e,k),depth+1);}
 walk(error);const types=new Set(['char','oid']),kinds=new Set(['UnsupportedNativeDataType','postgres','Postgres']);
 const adapterKind=nodes.map(n=>field(n,'kind')).find(v=>typeof v==='string'&&kinds.has(v)) as string|undefined;
 const nativeType=nodes.map(n=>field(n,'type')).find(v=>typeof v==='string'&&types.has(v)) as string|undefined;
 const sqlState=nodes.flatMap(n=>[field(n,'code'),field(n,'originalCode')]).find(v=>typeof v==='string'&&/^[0-9A-Z]{5}$/.test(v)&&!/^P\d{4}$/.test(v)) as string|undefined;
 const base=paymentProofFailure(error);
 return{...base,operation,sqlState:sqlState||base.sqlState,adapterKind:adapterKind||null,nativeType:nativeType||null,classification:adapterKind==='UnsupportedNativeDataType'?'ADAPTER_RESULT_TYPE':sqlState==='42501'?'DATABASE_PERMISSION':base.classification};
}
