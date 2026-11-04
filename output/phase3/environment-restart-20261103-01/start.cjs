'use strict';
const fs = require('node:fs'), path = require('node:path'), { createRequire } = require('node:module'), { fork } = require('node:child_process');
const root = path.resolve(__dirname, '../../..'), server = path.join(root, 'server');
const local = createRequire(path.join(server, 'package.json'));
const clean = () => Object.fromEntries(['SystemRoot','WINDIR','ComSpec','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','Path','PATH','PATHEXT'].filter(k => process.env[k]).map(k => [k,process.env[k]]));
if (['children.json','backend-config.json','frontend-config.json'].some(n => fs.existsSync(path.join(__dirname,n)))) throw Error('EXISTING_RESTART_STATE_INSPECT_FIRST');
let children = [];
function start(script, cwd, args) {
  const child = fork(script, [], { cwd, env: clean(), execArgv: args, windowsHide: true, silent: true });
  child.stdout.on('data', chunk => {
    const text = chunk.toString();
    if (/LOCAL_DEVELOPMENT_FRONTEND_READY_3000|FlyWithsafety API server running on port 5000/.test(text)) console.log(script.endsWith('.ts') ? 'LOCAL_DEVELOPMENT_BACKEND_LISTENING_5000' : 'LOCAL_DEVELOPMENT_FRONTEND_READY_3000');
  });
  child.stderr.on('data', () => { console.error(script.endsWith('.ts') ? 'BACKEND_DIAGNOSTIC_OUTPUT_SUPPRESSED' : 'FRONTEND_DIAGNOSTIC_OUTPUT_SUPPRESSED'); });
  child.on('exit', (code, signal) => {
    fs.appendFileSync(path.join(__dirname, 'lifecycle.jsonl'), JSON.stringify({ role: script.endsWith('.ts') ? 'backend' : 'frontend', pid: child.pid, exit: code, signal, atUTC: new Date().toISOString() }) + '\n');
    console.log('OWNED_DEVELOPMENT_CHILD_EXIT ' + child.pid + ' code=' + code);
  });
  return child;
}
children = [start(path.join(__dirname, 'backend.ts'), server, ['--import', require('node:url').pathToFileURL(local.resolve('tsx')).href]), start(path.join(__dirname, 'frontend.cjs'), path.join(root, 'client'), [])];
fs.writeFileSync(path.join(__dirname,'children.json'), JSON.stringify({ supervisor: process.pid, backend: children[0].pid, frontend: children[1].pid, mainApplication: true, credentialsInFile: false },null,2),{flag:'wx'});
console.log('OWNED_DEVELOPMENT_PROCESSES_STARTED_NO_WORKER_NO_PAYMENTS');
const timer = setInterval(() => {
  if (!fs.existsSync(path.join(__dirname, 'stop-owned-servers.request.json'))) return;
  clearInterval(timer);
  for (const child of children) if (child.connected) child.send({ action: 'stop-owned-development-server' });
}, 1000);
