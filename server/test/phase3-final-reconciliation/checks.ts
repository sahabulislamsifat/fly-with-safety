type FinancialRow={id:string;bookingId:string;status:string;captured:boolean;state:{status:string;captured:boolean;valId?:string;bankId?:string;currency:string;amountMinor:string}};
/** Local-state consistency only; never turns a saved provider observation into authority. */
export function checkFinancialRows(rows:FinancialRow[]){
 if(rows.length!==2||new Set(rows.map(r=>r.id)).size!==2||new Set(rows.map(r=>r.bookingId)).size!==2)throw Error('EXACT_TWO_RETAINED_PAYMENTS_REQUIRED');
 for(const r of rows){if(r.state.status!==r.status||r.state.captured!==r.captured||r.state.amountMinor!=='1200000'||r.state.currency!=='BDT')throw Error('RETAINED_FINANCIAL_COLUMNS_MISMATCH');}
 const success=rows.filter(r=>r.status==='VERIFIED'&&r.captured&&r.state.valId&&r.state.bankId),unresolved=rows.filter(r=>r.status==='SESSION_READY'&&!r.captured&&!r.state.valId&&!r.state.bankId);
 if(success.length!==1||unresolved.length!==1)throw Error('RETAINED_SUCCESS_OR_UNRESOLVED_MISMATCH');
 return{payments:2,verified:1,unresolved:1,noTerminalNegative:true};
}
