'use strict';
const prefix='p5-browser-20261108-01';
const emails=Object.fromEntries(['owner','admin','staff','customer','foreign','expired'].map(role=>[role,`${prefix}-${role}@example.invalid`]));
const ids=Object.fromEntries(['owner','customer','foreign'].map(role=>[role,`${prefix}-${role}`]));
const books=[prefix+'-own-book',prefix+'-foreign-book'];
const caps={User:5,Session:40,IdentityAccount:5,IdentitySession:40,IdentityMfa:3,IdentityMembership:4,IdentityAssignment:2,IdentityInvitation:3,IdentityAudit:100,Booking:2};
const userEmails=new Set(Object.entries(emails).filter(([role])=>role!=='expired').map(([,email])=>email));
function insist(ok,guard){if(!ok)throw Object.assign(Error(guard),{guard});}
function createLimiter(){
  const users=new Map(),sessions=new Set(),invitations=new Set(),audit=new Set();let writes=0,reads=0;
  const rawTags=new Set(['ensure-account','bind-session','mfa-enroll','mfa-confirm','mfa-version','mfa-revoke-other','mfa-reset-failures','mfa-proof','mfa-failed','mfa-step','recovery-consume','invite-create','invite-delivered','invite-user','invite-used','membership-add','role-change','suspend','invalidate','revoke','audit','assignment-upsert','bootstrap-role','browser-expire','browser-close-account','browser-close-session']);
  function reserve(){insist(++writes<=400,'FIXTURE_WRITE_CAP');}
  function raw(sql){
    const tag=/\/\*p5:([a-z-]+)\*\//.exec(sql?.sql||'')?.[1];insist(rawTags.has(tag),'RAW_MUTATION_NOT_ALLOWLISTED');
    const values=sql.values||[];
    if(tag==='invite-user'){insist(userEmails.has(values[1]),'INVITED_USER_SCOPE');users.set(values[0],values[1]);}
    if(tag==='invite-create'){insist([emails.admin,emails.staff,emails.expired].includes(values[1]),'INVITATION_RECIPIENT_SCOPE');invitations.add(values[0]);insist(invitations.size<=3,'INVITATION_ROW_CAP');}
    if(tag==='audit'){insist(users.has(values[1]),'AUDIT_ACTOR_SCOPE');insist(users.has(values[3])||invitations.has(values[3])||books.includes(values[3]),'AUDIT_TARGET_SCOPE');audit.add(values[0]);insist(audit.size<=100,'AUDIT_ROW_CAP');}
    if(tag==='bootstrap-role')insist(values[0]===ids.owner,'PRIMARY_OWNER_FIXTURE_SCOPE');
    if(['ensure-account','mfa-enroll','mfa-version','mfa-reset-failures','membership-add','invalidate','revoke'].includes(tag))insist(users.has(values[0]),'RAW_USER_SCOPE');
    if(['mfa-confirm','mfa-failed','mfa-step','recovery-consume','role-change','suspend'].includes(tag))insist(users.has(values.at(-1)),'RAW_USER_SCOPE');
    if(tag==='mfa-revoke-other')insist(users.has(values[0])&&sessions.has(values[1]),'RAW_SESSION_SCOPE');
    if(tag==='bind-session')insist(sessions.has(values[0]),'RAW_SESSION_SCOPE');
    if(tag==='mfa-proof')insist(sessions.has(values.at(-1)),'RAW_SESSION_SCOPE');
    if(['invite-used','invite-delivered','browser-expire'].includes(tag))insist(invitations.has(values[0]),'RAW_INVITATION_SCOPE');
    if(['browser-close-account','browser-close-session'].includes(tag))insist(values.length>0&&values.every(id=>users.has(id)),'RAW_CLOSURE_SCOPE');
    if(tag==='assignment-upsert')insist([...users].some(([id,email])=>id===values[1]&&email===emails.staff)&&books.includes(values.at(-1)),'ASSIGNMENT_FIXTURE_SCOPE');
    reserve();
  }
  function wrap(client){return new Proxy(client,{get(target,key){
    if(key==='$transaction')return (work,options)=>{insist(typeof work==='function','TRANSACTION_CALLBACK_REQUIRED');return target.$transaction(tx=>work(wrap(tx)),options);};
    if(key==='$executeRaw')return(sql)=>{raw(sql);return target.$executeRaw(sql);};
    if(key==='$executeRawUnsafe'||key==='$queryRawUnsafe')return()=>{throw Object.assign(Error('UNSAFE_SQL_FORBIDDEN'),{guard:'UNSAFE_SQL_FORBIDDEN'});};
    if(key==='$queryRaw')return(sql,...rest)=>{insist(++reads<=1500,'FIXTURE_READ_CAP');return target.$queryRaw(sql,...rest);};
    const value=Reflect.get(target,key);
    if(typeof key==='string'&&value&&typeof value==='object'&&!key.startsWith('_'))return new Proxy(value,{get(model,op){const method=Reflect.get(model,op);if(typeof method!=='function')return method;
      return async args=>{
        if(['create','update','updateMany','upsert','createMany','delete','deleteMany'].includes(op)){
          insist(['user','session','booking'].includes(key)&&!['delete','deleteMany','createMany','upsert'].includes(op),'MODEL_WRITE_FORBIDDEN');
          if(key==='user'){insist(op==='create'&&userEmails.has(args.data.email)&&Object.values(ids).includes(args.data.id),'SEEDED_USER_SCOPE');users.set(args.data.id,args.data.email);insist(users.size<=5,'USER_ROW_CAP');}
          if(key==='session'){if(op==='create')insist(users.has(args.data.userId)&&sessions.size<40,'SESSION_USER_SCOPE_OR_CAP');else insist(sessions.has(args.where.id),'SESSION_ID_SCOPE');}
          if(key==='booking')insist(op==='create'&&books.includes(args.data.id)&&[ids.customer,ids.foreign].includes(args.data.userId)&&args.data.status===undefined,'BOOKING_FIXTURE_SCOPE');
          reserve();
        }else insist(++reads<=1500,'FIXTURE_READ_CAP');
        const result=await method.call(model,args);
        if(key==='session'&&op==='create'){sessions.add(result.id);insist(sessions.size<=40,'SESSION_ROW_CAP');}
        return result;
      };
    }});
    return typeof value==='function'?value.bind(target):value;
  }});}
  return {wrap,users,sessions,invitations,summary:()=>({writeAttempts:writes,readOperations:reads,ownedUsers:users.size,ownedSessions:sessions.size,ownedInvitations:invitations.size})};
}
module.exports={prefix,emails,ids,books,caps,userEmails,createLimiter,insist};
