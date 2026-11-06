\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
SELECT "tranId" AS synthetic_transaction_id
FROM public."GatewayPayment"
WHERE id='8fbd96d2-69a5-4f79-991a-623dd8de5057'
AND "bookingId"='e77192b4-357f-47a6-ad59-dc35b980330e'
AND "userId"='d8505f78-a138-405e-a750-b23d82af87ad'
AND current_database()='flywithsafety_local_integration'
AND current_user='flywithsafe_phase2_booking_test'
AND inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=5432
AND (SELECT oid FROM pg_database WHERE datname=current_database())=34701
AND current_setting('transaction_read_only')='on';
ROLLBACK;
