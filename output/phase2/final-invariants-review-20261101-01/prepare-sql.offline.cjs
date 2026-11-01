// Offline generation from the actual immutable retained-ID ledger. No connection.
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, ''));
const c = read('output/phase2/commercial-continuation-20261101-01/retained-contract.json');
const ledger = fs.readFileSync(path.join(root, 'output/phase2/commercial-continuation-20261101-01/fixture-ledger.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
const snapshot = ledger.findLast(row => row.kind === 'actual-retained-record-ids');
const rollback = ledger.find(row => row.kind === 'rollback-only-history');
if (!snapshot || !rollback || snapshot.bookings.length !== 1 || snapshot.sessions.length !== 9 || snapshot.history.length !== 4 || snapshot.notifications.length !== 3) throw new Error('ACTUAL_LEDGER_SHAPE_STOP');
const b = snapshot.bookings[0], owner = c.actors[0], staff = c.actors[2];
if (b.commercialRevision !== 5 || b.quoteIds.length !== 3 || b.paymentIds.length !== 1 || b.receiptIds.length !== 5) throw new Error('ACTUAL_COMMERCIAL_SHAPE_STOP');
function literal(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9@._-]{1,160}$/.test(value)) throw new Error('PUBLIC_IDENTIFIER_INVALID');
  return "'" + value + "'";
}
const values = rows => rows.map(row => '(' + row.map(literal).join(',') + ')').join(',\n');
const expected = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
const checks = [];
function add(id, target, sql) { checks.push('(' + literal(id) + ',' + expected(target) + ',to_jsonb((' + sql + ')))'); }
for (const [table, count, id] of [['User',4,'users'],['Session',9,'sessions'],['Booking',1,'bookings'],['BookingPassenger',1,'passengers'],['BookingStatusHistory',4,'history'],['IdempotencyRecord',1,'idempotency'],['NotificationOutbox',3,'notifications']])
  add(id, count, `SELECT count(*)::int FROM public."${table}"`);
add('userOwnership', true, 'SELECT count(*)=4 FROM public."User" u JOIN expected_users e ON u.id=e.id AND u.email=e.email AND u.role::text=e.role AND u."emailVerified"');
add('sessionOwnership', true, 'SELECT count(*)=9 FROM public."Session" s JOIN expected_sessions e ON s.id=e.id AND s."userId"=e.user_id');
add('bookingOwnership', true, `SELECT count(*)=1 FROM b WHERE "userId"=${literal(owner.id)} AND "referenceNumber"=${literal(b.referenceNumber)} AND currency='BDT'`);
add('bookingStatus', 'COMPLETED', "SELECT CASE WHEN status='COMPLETED' THEN 'COMPLETED' ELSE 'OTHER' END FROM b");
add('totalPrice', 12000, 'SELECT "totalPrice" FROM b');
add('passengerOwnership', true, `SELECT count(*)=1 FROM public."BookingPassenger" WHERE id=${literal(snapshot.passengers[0].id)} AND "bookingId"=${literal(b.id)} AND "firstName"='Synthetic' AND "lastName"='Traveller' AND "passengerType"='adult'`);
add('historyExactIds', true, 'SELECT count(*)=4 FROM h JOIN expected_history e ON h.id=e.id');
add('historyCount', 4, 'SELECT count(*)::int FROM h');
add('historyTimestampsPresent', true, 'SELECT count("createdAt")=4 FROM h');
add('initialHistoryContract', true, `SELECT count(*)=1 FROM h WHERE id=${literal(c.history.id)} AND "fromStatus"='PENDING' AND "toStatus"='PENDING' AND "changedBy"='CUSTOMER' AND reason='Initial booking submission'`);
add('acceptanceActor', true, `SELECT count(*)=1 FROM h WHERE "fromStatus"='PENDING' AND "toStatus"='PENDING' AND reason='Quotation accepted; awaiting staff processing' AND "changedBy"=${literal(owner.id)}`);
add('statusTransitionCount', 2, 'SELECT count(*)::int FROM h WHERE "fromStatus"<>"toStatus"');
add('statusActors', 'STAFF_EMAIL', `SELECT CASE WHEN count(*)=0 THEN 'MISSING' WHEN count(*)=2 AND bool_and(coalesce("changedBy"=${literal(staff.email)},false)) THEN 'STAFF_EMAIL' WHEN count(*)=2 AND bool_and(coalesce("changedBy"=${literal(staff.id)},false)) THEN 'STAFF_ID' ELSE 'OTHER' END FROM h WHERE "fromStatus"<>"toStatus"`);
add('confirmationAudit', true, `SELECT count(*)=1 FROM h WHERE "fromStatus"='PENDING' AND "toStatus"='CONFIRMED' AND "changedBy"=${literal(staff.email)} AND reason='Synthetic continuation verification'`);
add('completionAudit', true, `SELECT count(*)=1 FROM h WHERE "fromStatus"='CONFIRMED' AND "toStatus"='COMPLETED' AND "changedBy"=${literal(staff.email)} AND reason='Synthetic continuation verification'`);
add('idempotencyOwnership', true, `SELECT count(*)=1 FROM public."IdempotencyRecord" WHERE id=${literal(snapshot.idempotency[0].id)} AND "userId"=${literal(owner.id)} AND "referenceNumber"=${literal(b.referenceNumber)}`);
add('notificationOwnership', true, `SELECT count(*)=3 FROM public."NotificationOutbox" o JOIN expected_outbox e ON o.id=e.id WHERE o.recipient=${literal(owner.email)} AND o.payload->'params'->>'referenceNumber'=${literal(b.referenceNumber)}`);
add('confirmationNotification', true, `SELECT count(*)=1 FROM public."NotificationOutbox" WHERE id=${literal(c.notification.id)} AND payload->>'template'='BOOKING_CONFIRMATION'`);
for (const status of ['CONFIRMED','COMPLETED']) add('notification_' + status, true, `SELECT count(*)=1 FROM public."NotificationOutbox" o JOIN expected_outbox e ON o.id=e.id WHERE o.payload->>'template'='BOOKING_STATUS' AND o.payload->'params'->>'status'='${status}'`);
add('commercialVersion', true, "SELECT commercial->'version'='1'::jsonb AND commercial->'revision'='5'::jsonb FROM b");
add('quoteCount', 3, 'SELECT count(*)::int FROM q');
add('quoteExactIds', true, 'SELECT count(*)=3 AND count(DISTINCT q.data->>\'id\')=3 FROM q JOIN expected_quotes e ON q.data->>\'id\'=e.id');
add('acceptedQuoteCount', 1, "SELECT count(*)::int FROM q WHERE data->>'acceptedAt' IS NOT NULL");
add('acceptedQuoteLink', true, `SELECT count(*)=1 FROM q WHERE data->>'id'=${literal(b.quoteIds[2])} AND data->>'acceptedAt' IS NOT NULL AND data->'amount'='12000'::jsonb AND data->>'currency'='BDT'`);
add('paymentCount', 1, 'SELECT count(*)::int FROM p');
add('unverifiedPaymentLink', true, `SELECT count(*)=1 FROM p WHERE data->>'id'=${literal(b.paymentIds[0])} AND data->>'quoteId'=${literal(b.quoteIds[2])} AND data->'amount'='12000'::jsonb AND data->>'currency'='BDT' AND data->>'status'='RECORDED_UNVERIFIED' AND data->>'method'='BANK_TRANSFER' AND data->>'reference'='SYN-CONT-PAY-001'`);
add('receiptCount', 5, 'SELECT count(*)::int FROM r');
add('receiptIdsAndActors', true, "SELECT count(*)=5 AND count(DISTINCT r.data->>'id')=5 FROM r JOIN expected_receipts e ON r.data->>'id'=e.id AND r.data->>'actor'=e.actor WHERE r.data->>'command' ~ '^sha256:[a-f0-9]{64}$'");
add('noPaymentVerification', true, "SELECT coalesce(\"bookingDetails\"->>'paymentStatus','')<>'PAYMENT_VERIFIED' FROM b");
add('rollbackHistoryAbsent', true, `SELECT count(*)=0 FROM public."BookingStatusHistory" WHERE id=${literal(rollback.id)}`);
add('rollbackBookingAbsent', true, `SELECT count(*)=0 FROM public."Booking" WHERE id=${literal(rollback.absentBookingId)}`);
const sql = String.raw`\set ON_ERROR_STOP on
\pset pager off
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='5s';
SET LOCAL lock_timeout='2s';
DO $guard$
BEGIN
 IF current_database()<>'flywithsafe_phase2_booking_integration' OR current_user<>'flywithsafe_phase2_booking_test'
 OR session_user<>'flywithsafe_phase2_booking_test' OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
 OR inet_server_port() IS DISTINCT FROM 5432 OR current_setting('transaction_read_only')<>'on'
 THEN RAISE EXCEPTION 'PHASE2_FINAL_STATE_WRONG_IDENTITY'; END IF;
END $guard$;
WITH expected_users(id,email,role) AS (VALUES ${values(c.actors.map(a=>[a.id,a.email,a.role]))}),
expected_sessions(id,user_id) AS (VALUES ${values(snapshot.sessions.map(s=>[s.id,s.userId]))}),
expected_history(id) AS (VALUES ${values(snapshot.history.map(h=>[h.id]))}),
expected_outbox(id) AS (VALUES ${values(snapshot.notifications.map(n=>[n.id]))}),
expected_quotes(id) AS (VALUES ${values(b.quoteIds.map(id=>[id]))}),
expected_receipts(id,actor) AS (VALUES ${values(b.receiptIds.map((id,i)=>[id,i===3?owner.id:staff.id]))}),
b AS (SELECT *,"bookingDetails"->'commercial' AS commercial FROM public."Booking" WHERE id=${literal(b.id)}),
h AS (SELECT * FROM public."BookingStatusHistory" WHERE "bookingId"=${literal(b.id)}),
q AS (SELECT value AS data FROM b CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(commercial->'quotes')='array' THEN commercial->'quotes' ELSE '[]'::jsonb END)),
p AS (SELECT value AS data FROM b CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(commercial->'payments')='array' THEN commercial->'payments' ELSE '[]'::jsonb END)),
r AS (SELECT value AS data FROM b CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(commercial->'receipts')='array' THEN commercial->'receipts' ELSE '[]'::jsonb END)),
checks(invariant,expected,observed) AS (VALUES
${checks.join(',\n')})
SELECT jsonb_agg(jsonb_build_object('invariant',invariant,'expected',expected,'observed',observed,'matched',expected IS NOT DISTINCT FROM observed,
 'legacyExpected',CASE WHEN invariant='statusActors' THEN '"STAFF_ID"'::jsonb ELSE NULL END) ORDER BY invariant) AS invariant_results,
 bool_and(expected IS NOT DISTINCT FROM observed) AS all_matched FROM checks
\gset
\echo :invariant_results
ROLLBACK;
\if :all_matched
 \echo PHASE2_FINAL_STATE_READONLY_VERIFIED_PASS
\else
 \echo PHASE2_FINAL_STATE_READONLY_INVARIANT_STOP
 \quit 1
\endif
`;
if (/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE|CREATE|ALTER|COMMIT)\b/.test(sql)) throw new Error('READONLY_SQL_SCOPE_STOP');
if (!sql.startsWith('\\set ON_ERROR_STOP on') || !sql.includes('\\gset') || !sql.includes('\\if :all_matched')) throw new Error('PSQL_META_QUOTING_STOP');
fs.writeFileSync(path.join(__dirname, 'verify-final.readonly.sql'), sql);
fs.writeFileSync(path.join(__dirname, 'expected-inventory.json'), JSON.stringify({ actors:c.actors, snapshot, rollbackOnly:rollback, namedInvariants:checks.length },null,2));
console.log(JSON.stringify({generated:true,namedInvariants:checks.length,expectedRows:23,databaseConnections:0}));
