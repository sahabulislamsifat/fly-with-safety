'use strict';
// Offline-reviewed correction for a future separately approved runner.
// Do not inherit credentials, SSH agent, user configs, or unrelated env values.
function sshEnvironment(input){
 const env={};for(const k of ['SystemRoot','WINDIR','TEMP','TMP','ProgramData'])if(input[k])env[k]=input[k];
 if(!env.SystemRoot||!env.ProgramData)throw Error('WINDOWS_SSH_ENVIRONMENT_INCOMPLETE');
 return env;
}
function exitEvidence(code,signal){return{nativeExitCode:Number.isInteger(code)?code:null,signal:['SIGTERM','SIGKILL','SIGINT'].includes(signal)?signal:null};}
module.exports={sshEnvironment,exitEvidence};
