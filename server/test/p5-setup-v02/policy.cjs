'use strict';
const crypto = require('node:crypto');
const database = 'flywithsafety_p5_identity_scope_test';
const app = 'fws_p5_identity_app', owner = 'fws_p5_identity_migrator';
const mutable = ['User','Account','EmailVerificationToken','PasswordResetToken','Session','IdempotencyRecord','Destination','Package','VisaInfo','FlightInquiry','HotelInquiry','PackageInquiry','VisaInquiry','ContactMessage','Testimonial','Booking','BookingPassenger','NotificationOutbox','IdentityAccount','IdentitySession','IdentityMembership','IdentityAssignment','IdentityInvitation','IdentityMfa'];
const append = ['IdentityAudit','GatewayPaymentEvent','BookingStatusHistory'];
const tables = [...mutable,...append,'GatewayPayment','GatewayRefund'].sort();
function insist(ok, code) { if (!ok) throw Object.assign(new Error(code), { guard: code }); }
function credentials(input) {
  insist(input && typeof input.maintenanceUser==='string' && /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(input.maintenanceUser) && ![app,owner].includes(input.maintenanceUser), 'MAINTENANCE_IDENTITY_REQUIRED');
  insist(typeof input.maintenancePassword === 'string' && input.maintenancePassword.length > 0 && input.maintenancePassword.length <= 512, 'MAINTENANCE_PASSWORD_REQUIRED');
  for (const field of ['appPassword','ownerPassword']) insist(typeof input[field] === 'string' && /^[!-~]{20,128}$/.test(input[field]) && /[a-z]/.test(input[field]) && /[A-Z]/.test(input[field]) && /[0-9]/.test(input[field]) && /[^A-Za-z0-9]/.test(input[field]), 'NEW_PRIVATE_PASSWORD_POLICY');
  insist(new Set([input.maintenancePassword,input.appPassword,input.ownerPassword]).size === 3, 'DISTINCT_PRIVATE_PASSWORDS_REQUIRED');
  return input;
}
// PostgreSQL SCRAM-SHA-256 stored verifier. ASCII input avoids SASLprep ambiguity.
// The plaintext password is never placed into SQL; verifier text is never logged.
function verifier(password, salt = crypto.randomBytes(16), iterations = 4096) {
  insist(/^[!-~]{20,128}$/.test(password), 'NEW_PRIVATE_PASSWORD_POLICY');
  insist(Number.isSafeInteger(iterations) && iterations>=4096 && iterations<=100000,'SCRAM_POLICY_REQUIRES_REVIEW');
  const salted = crypto.pbkdf2Sync(password,salt,iterations,32,'sha256');
  const client = crypto.createHmac('sha256',salted).update('Client Key').digest();
  const stored = crypto.createHash('sha256').update(client).digest();
  const server = crypto.createHmac('sha256',salted).update('Server Key').digest();
  try { return `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${stored.toString('base64')}:${server.toString('base64')}`; }
  finally { for (const bytes of [salted,client,stored,server]) bytes.fill(0); }
}
function configuration(user,password,target='postgres',timeout=5000) {
  insist(target === 'postgres' || target === database, 'CONNECTION_TARGET_REJECTED');
  return { host:'127.0.0.1',port:5432,database:target,user,password,connectionTimeoutMillis:5000,statement_timeout:timeout,query_timeout:timeout+1000,application_name:'FWS_P5_APPROVED_SETUP',options:'-c search_path=pg_catalog,public -c lock_timeout=5000' };
}
function ownerUrl(password) {
  const url=new URL('postgresql://127.0.0.1:5432/'+database);url.username=owner;url.password=encodeURIComponent(password);return url.href;
}
function identity(row,target,user,oid) {
  insist(row && row.database===target && row.role===user && row.address==='127.0.0.1' && row.port===5432, 'SERVER_IDENTITY_MISMATCH');
  insist(Number.isSafeInteger(row.oid) && row.oid>0 && row.oid!==34701 && (oid===undefined || oid===row.oid), 'DATABASE_OID_MISMATCH');
}
function safeFailure(error) {
  return { guard: /^[A-Z][A-Z0-9_]{0,79}$/.test(error?.guard || '') ? error.guard : 'NATIVE_OPERATION_FAILED',
    sqlState: /^[0-9A-Z]{5}$/.test(error?.code || '') ? error.code : null,
    networkCode: ['ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENOTFOUND','EHOSTUNREACH'].includes(error?.code) ? error.code : null,
    prismaCode: /^P[0-9]{4}$/.test(error?.prismaCode || '') ? error.prismaCode : null,
    exitCode: Number.isInteger(error?.exitCode) ? error.exitCode : null };
}
module.exports = { database,app,owner,mutable,append,tables,insist,credentials,verifier,configuration,ownerUrl,identity,safeFailure };
