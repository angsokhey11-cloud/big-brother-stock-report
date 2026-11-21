-- BIG BROTHER: expose the existing issued-batch selling window to Batch Editor.
-- Preserves the current stock edit permissions and all other response fields.
-- Apply to Cloud and Local Brain database before testing the editor.
DO $migration$
DECLARE
  v_old text;
  v_new text;
  v_marker text := '''batchDate'',v_batch.batch_date::text,';
  v_extra text :=
    chr(10)||'      ''sellingDateFrom'',v_batch.selling_date_from::text,'||
    chr(10)||'      ''sellingDateTo'',v_batch.selling_date_to::text,';
BEGIN
  v_old := pg_get_functiondef('public.bb_stock_batch_edit_options(text)'::regprocedure);
  IF position('''sellingDateFrom''' IN v_old)>0 THEN
    RAISE NOTICE 'Batch Editor selling dates already exposed; skipping';
    RETURN;
  END IF;
  IF position(v_marker IN v_old)=0 THEN
    RAISE EXCEPTION 'Batch Editor RPC definition changed: stop rather than overwrite other updates';
  END IF;
  v_new := replace(v_old,v_marker,v_marker||v_extra);
  EXECUTE v_new;
END;
$migration$;
