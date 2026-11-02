DO $snapshot$
DECLARE relation_entry record; row_state jsonb; rows_state jsonb := '{}'::jsonb; state jsonb;
BEGIN
 FOR relation_entry IN SELECT c.oid,c.relname FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN('r','p') ORDER BY c.relname LOOP
  IF NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid=relation_entry.oid AND attname='id' AND attnum>0 AND NOT attisdropped) THEN RAISE EXCEPTION 'UNSUPPORTED_TABLE_IDENTITY_STOP'; END IF;
  EXECUTE format('SELECT jsonb_build_object(''count'',count(*),''ids'',md5(coalesce(jsonb_agg(id ORDER BY id)::text,''[]''))) FROM public.%I',relation_entry.relname) INTO row_state;
  rows_state := rows_state || jsonb_build_object(relation_entry.relname,row_state);
 END LOOP;
 SELECT jsonb_build_object(
  'target_oid',(SELECT oid FROM pg_database WHERE datname=current_database()),
  'rows',rows_state,
  'columns',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relkind,c.relowner,c.relacl::text,c.relrowsecurity,a.attnum,a.attname,a.atttypid,a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) ORDER BY c.relname,a.attnum) FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE c.relnamespace='public'::regnamespace AND c.relkind IN('r','p')),
  'constraints',(SELECT jsonb_agg(jsonb_build_array(oid,conrelid,conname,contype,pg_get_constraintdef(oid)) ORDER BY conrelid,conname) FROM pg_constraint WHERE connamespace='public'::regnamespace),
  'indexes',(SELECT jsonb_agg(jsonb_build_array(tablename,indexname,indexdef) ORDER BY tablename,indexname) FROM pg_indexes WHERE schemaname='public'),
  'enums',(SELECT jsonb_agg(jsonb_build_array(t.oid,t.typname,e.enumlabel,e.enumsortorder) ORDER BY t.typname,e.enumsortorder) FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typnamespace='public'::regnamespace),
  'functions',(SELECT jsonb_agg(jsonb_build_array(oid,proname,proowner,proacl::text,proargtypes::text,prorettype) ORDER BY oid) FROM pg_proc WHERE pronamespace='public'::regnamespace),
  'roles',(SELECT jsonb_agg(jsonb_build_array(oid,rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit) ORDER BY oid) FROM pg_roles),
  'memberships',(SELECT jsonb_agg(jsonb_build_array(roleid,member,grantor,admin_option) ORDER BY roleid,member,grantor) FROM pg_auth_members),
  'databases',(SELECT jsonb_agg(jsonb_build_array(oid,CASE WHEN oid=34701 THEN '_LOCAL_RENAME_TARGET_' ELSE datname END,datdba,datacl::text,datconnlimit,datallowconn,datistemplate,encoding,datcollate,datctype) ORDER BY oid) FROM pg_database),
  'schemas',(SELECT jsonb_agg(jsonb_build_array(oid,nspname,nspowner,nspacl::text) ORDER BY oid) FROM pg_namespace WHERE nspname='public'),
  'migrations',(SELECT jsonb_agg(jsonb_build_array(id,migration_name,checksum,finished_at,rolled_back_at,applied_steps_count) ORDER BY migration_name,id) FROM public._prisma_migrations)
 ) INTO state;
 PERFORM set_config('flywithsafe.rename_metadata',state::text,true);
END $snapshot$;
