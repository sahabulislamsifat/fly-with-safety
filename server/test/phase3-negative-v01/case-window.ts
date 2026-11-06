/** No provider/DB operations. The future controller must arm only on explicit
 * owner readiness, and open the clock after actual checkout navigation. */
export class OwnerCaseWindow {
 private ready=false;private opened:number|null=null;private complete=false;
 constructor(private clock:()=>number,readonly budgetMs=1200000){if(!Number.isSafeInteger(budgetMs)||budgetMs<60000||budgetMs>1200000)throw Error('BOUNDED_CASE_BUDGET_REQUIRED');}
 ownerReady(){this.ready=true;}
 assertMayInitiate(){if(!this.ready||this.opened!==null)throw Error('OWNER_READY_REQUIRED');}
 checkoutOpened(){this.assertMayInitiate();this.opened=this.clock();}
 finish(){if(this.opened===null||this.expired())throw Error('CASE_NOT_COMPLETABLE');this.complete=true;}
 remaining(){return this.opened===null?this.budgetMs:Math.max(0,this.budgetMs-(this.clock()-this.opened));}
 expired(){return !this.complete&&this.opened!==null&&this.remaining()===0;}
 cleanupReason(){return this.complete?'CASE_COMPLETED':this.expired()?'OWNER_CHECKOUT_DEADLINE':'OWNER_STOP_OR_RUN_FAILURE';}
}
