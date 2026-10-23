-- REVIEW ONLY: one catalog SELECT. Zero rows means these required checks passed.
-- Run within the existing read-only preflight connection, never as migration SQL.
WITH required_tables(name) AS (VALUES
 ('Booking'),('BookingPassenger'),('BookingStatusHistory'),('ContactMessage')),
required_columns(table_name,column_name,udt_name,nullable) AS (VALUES
 ('Booking','id','text','NO'),('Booking','referenceNumber','text','NO'),
 ('Booking','bookingType','BookingType','NO'),('Booking','bookingModel','BookingModel','NO'),
 ('Booking','status','BookingStatus','NO'),('Booking','customerName','text','NO'),
 ('Booking','customerEmail','text','NO'),('Booking','customerPhone','text','YES'),
 ('Booking','totalPrice','int4','NO'),('Booking','currency','text','NO'),
 ('Booking','bookingDetails','jsonb','YES'),('Booking','notes','text','YES'),
 ('Booking','userId','text','YES'),('Booking','createdAt','timestamp','NO'),('Booking','updatedAt','timestamp','NO'),
 ('BookingPassenger','id','text','NO'),('BookingPassenger','bookingId','text','NO'),
 ('BookingPassenger','firstName','text','NO'),('BookingPassenger','lastName','text','NO'),
 ('BookingPassenger','passengerType','text','NO'),('BookingPassenger','gender','text','YES'),
 ('BookingPassenger','dateOfBirth','text','YES'),('BookingPassenger','passportNumber','text','YES'),
 ('BookingPassenger','passportExpiry','text','YES'),('BookingPassenger','nationality','text','YES'),
 ('BookingPassenger','createdAt','timestamp','NO'),
 ('BookingStatusHistory','id','text','NO'),('BookingStatusHistory','bookingId','text','NO'),
 ('BookingStatusHistory','fromStatus','BookingStatus','NO'),('BookingStatusHistory','toStatus','BookingStatus','NO'),
 ('BookingStatusHistory','reason','text','YES'),('BookingStatusHistory','changedBy','text','YES'),
 ('BookingStatusHistory','createdAt','timestamp','NO'),
 ('ContactMessage','serviceType','text','YES'),('ContactMessage','status','ContactStatus','NO')),
required_enums(name,labels) AS (VALUES
 ('BookingType',ARRAY['FLIGHT','HOTEL','PACKAGE']),
 ('BookingStatus',ARRAY['PENDING','CONFIRMED','CANCELLED','COMPLETED']),
 ('BookingModel',ARRAY['AGENCY_INQUIRY','PROVIDER_REDIRECT','DIRECT_API']),
 ('ContactStatus',ARRAY['NEW','OPEN','IN_PROGRESS','RESOLVED','CLOSED'])),
actual_enums AS (
 SELECT t.typname AS name,array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
 FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum e ON e.enumtypid=t.oid
 JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' GROUP BY t.typname),
required_indexes(table_name,index_name,columns,is_unique,is_primary) AS (VALUES
 ('Booking','Booking_pkey',ARRAY['id'],true,true),
 ('BookingPassenger','BookingPassenger_pkey',ARRAY['id'],true,true),
 ('BookingStatusHistory','BookingStatusHistory_pkey',ARRAY['id'],true,true),
 ('IdempotencyRecord','IdempotencyRecord_operation_principal_key_key',ARRAY['operation','principal','key'],true,false),
 ('NotificationOutbox','NotificationOutbox_idempotencyKey_key',ARRAY['idempotencyKey'],true,false),
 ('Booking','Booking_referenceNumber_key',ARRAY['referenceNumber'],true,false),
 ('Booking','Booking_referenceNumber_idx',ARRAY['referenceNumber'],false,false),
 ('Booking','Booking_customerEmail_idx',ARRAY['customerEmail'],false,false),
 ('Booking','Booking_status_idx',ARRAY['status'],false,false),
 ('Booking','Booking_createdAt_idx',ARRAY['createdAt'],false,false),
 ('BookingPassenger','BookingPassenger_bookingId_idx',ARRAY['bookingId'],false,false),
 ('BookingStatusHistory','BookingStatusHistory_bookingId_idx',ARRAY['bookingId'],false,false)),
actual_indexes AS (
 SELECT t.relname AS table_name,idx.relname AS index_name,i.indisunique AS is_unique,
 i.indisprimary AS is_primary,i.indisvalid AND i.indisready AS usable,
 i.indpred IS NULL AND i.indexprs IS NULL AND am.amname='btree' AS ordinary_btree,
 ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY k(num,ord)
       JOIN pg_catalog.pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.num ORDER BY k.ord) AS columns
 FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class t ON t.oid=i.indrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
 JOIN pg_catalog.pg_class idx ON idx.oid=i.indexrelid JOIN pg_catalog.pg_am am ON am.oid=idx.relam
 WHERE n.nspname='public'),
required_fks(table_name,column_name,target_table,delete_action) AS (VALUES
 ('Booking','userId','User','n'),('BookingPassenger','bookingId','Booking','c'),
 ('BookingStatusHistory','bookingId','Booking','c')),
actual_fks AS (
 SELECT t.relname AS table_name,r.relname AS target_table,rn.nspname AS target_schema,
 c.confdeltype::text AS delete_action,c.confupdtype::text AS update_action,c.convalidated AS validated,
 ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num,ord)
 JOIN pg_catalog.pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.num ORDER BY k.ord) AS columns,
 ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num,ord)
 JOIN pg_catalog.pg_attribute a ON a.attrelid=r.oid AND a.attnum=k.num ORDER BY k.ord) AS targets
 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class t ON t.oid=c.conrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
 JOIN pg_catalog.pg_class r ON r.oid=c.confrelid JOIN pg_catalog.pg_namespace rn ON rn.oid=r.relnamespace
 WHERE c.contype='f' AND n.nspname='public')
SELECT 'Missing base table: '||r.name AS issue FROM required_tables r
WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables t WHERE t.table_schema='public' AND t.table_name=r.name AND t.table_type='BASE TABLE')
UNION ALL
SELECT 'Missing or mismatched column: '||r.table_name||'.'||r.column_name FROM required_columns r
WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public'
 AND c.table_name=r.table_name AND c.column_name=r.column_name AND c.udt_name=r.udt_name AND c.is_nullable=r.nullable
 AND c.udt_schema=CASE WHEN r.udt_name IN ('text','int4','jsonb','timestamp') THEN 'pg_catalog' ELSE 'public' END)
UNION ALL
SELECT 'Missing or mismatched enum labels: '||r.name FROM required_enums r
WHERE NOT EXISTS (SELECT 1 FROM actual_enums a WHERE a.name=r.name AND a.labels @> r.labels AND r.labels @> a.labels)
UNION ALL
SELECT 'Missing or mismatched index: '||r.index_name FROM required_indexes r
WHERE NOT EXISTS (SELECT 1 FROM actual_indexes a WHERE a.table_name=r.table_name AND a.index_name=r.index_name
 AND a.columns=r.columns AND a.is_unique=r.is_unique AND a.is_primary=r.is_primary AND a.usable AND a.ordinary_btree)
UNION ALL
SELECT 'Missing or mismatched foreign key: '||r.table_name||'.'||r.column_name FROM required_fks r
WHERE NOT EXISTS (SELECT 1 FROM actual_fks a WHERE a.table_name=r.table_name AND a.columns=ARRAY[r.column_name]
 AND a.target_schema='public' AND a.target_table=r.target_table AND a.targets=ARRAY['id']
 AND a.delete_action=r.delete_action AND a.update_action='c' AND a.validated)
UNION ALL
SELECT 'Contact status default is not NEW' WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
 WHERE table_schema='public' AND table_name='ContactMessage' AND column_name='status'
 AND column_default IN ('''NEW''::"ContactStatus"','''NEW''::public."ContactStatus"'))
UNION ALL
SELECT 'Booking timestamps must use millisecond precision' WHERE EXISTS (SELECT 1 FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN ('Booking','BookingPassenger','BookingStatusHistory')
 AND udt_name='timestamp' AND datetime_precision IS DISTINCT FROM 3)
ORDER BY issue;
