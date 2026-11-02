// Fixed read-only inspection of the identified local FlyWithSafe server process.
const fs = require('node:fs');
const targetPid = 23320;
(async () => {
  let socket;
  try {
    try { await fetch('http://127.0.0.1:9229/json/list'); throw new Error('EXISTING_INSPECTOR'); }
    catch (error) { if(error.message==='EXISTING_INSPECTOR') throw error; }
    process._debugProcess(targetPid);
    let tabs;
    for(let i=0;i<20;i++){try{tabs=await(await fetch('http://127.0.0.1:9229/json/list')).json();break;}catch{await new Promise(r=>setTimeout(r,100));}}
    if(!tabs || tabs.length!==1) throw new Error('INSPECTOR_UNAVAILABLE');
    const endpoint=new URL(tabs[0].webSocketDebuggerUrl);
    if(endpoint.hostname!=='127.0.0.1' && endpoint.hostname!=='localhost') throw new Error('NONLOCAL_INSPECTOR');
    socket=new WebSocket(endpoint.href);
    await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
    const reply=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('READONLY_INSPECTION_TIMEOUT')),8000);
      socket.onmessage=event=>{const data=JSON.parse(event.data);if(data.id===1){clearTimeout(timer);resolve(data);}};
    });
    const expression=`(async()=>{const p=globalThis.prisma;if(!p)return {runtimeClientAvailable:false};const rows=await p.$queryRawUnsafe('SELECT current_database() AS db,current_user AS role,host(inet_server_addr()) AS host,inet_server_port() AS port');const r=rows[0];return {runtimeClientAvailable:true,database:r.db,role:r.role,serverAddress:r.host,serverPort:r.port};})()`;
    socket.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));
    const response=await reply;
    const value=response.result?.result?.value;
    if(!value) throw new Error('READONLY_INSPECTION_FAILED');
    const result={pid:targetPid,readOnly:true,actualRunningClient:true,...value};
    fs.writeFileSync('output/phase2/sameports-normal-runtime-identity.json',JSON.stringify(result,null,2),{flag:'wx'});
    console.log(JSON.stringify(result));
  } finally {
    if(socket && socket.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:2,method:'Runtime.evaluate',params:{expression:"setTimeout(()=>process.getBuiltinModule('inspector').close(),50);true",returnByValue:true}}));await new Promise(r=>setTimeout(r,150));socket.close();}
  }
})().catch(()=>{console.error('LOCAL_RUNTIME_READONLY_INSPECTION_STOP');process.exitCode=1;});
